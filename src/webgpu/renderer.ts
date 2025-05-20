// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

import { Color } from './color';
import { LambertianMaterial, MetalMaterial, DielectricMaterial } from './material';
import { Sphere } from './sphere';
import { Camera } from './camera';



function buildFinalSceneSpheresArray(): Sphere[] {
  const spheres: Sphere[] = [];

  const groundMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
  const groundSphere = new Sphere([0, -1000, 0], 1000, groundMaterial);
  spheres.push(groundSphere);

  for (let i = -11; i < 11; i++) {
    for (let j = -11; j < 11; j++) {
      const materialType = Math.random();
      const center = [i + 0.9 * Math.random(), 0.2, j + 0.9 * Math.random()];
      const nearMetalBall = [4, 0.2, 0];
      const distance = Math.sqrt((center[0] - nearMetalBall[0]) ** 2 + (center[1] - nearMetalBall[1]) ** 2 + (center[2] - nearMetalBall[2]) ** 2);
      if (distance < 0.9) {
        continue; // Skip this sphere if it's too close to the metal ball
      }
      let material: any;

      if (materialType < 0.8) {
        // diffuse
        material = new LambertianMaterial(new Color(Math.random() * Math.random(), Math.random() * Math.random(), Math.random() * Math.random()));
      } else if (materialType < 0.95) {
        // metal
        const albedo = new Color(Math.random()*0.5 + 0.5, Math.random()*0.5 + 0.5, Math.random()*0.5 + 0.5);
        const fuzz = Math.random() * 0.5;
        material = new MetalMaterial(albedo, fuzz);
      } else {
        // glass
        material = new DielectricMaterial(1.5);
      }

      const sphere = new Sphere(center, 0.2, material);
      spheres.push(sphere);
    }
  }

  const material1 = new DielectricMaterial(1.5);
  const sphere1 = new Sphere([0, 1, 0], 1, material1);
  spheres.push(sphere1);
  const material2 = new LambertianMaterial(new Color(0.4, 0.2, 0.1));
  const sphere2 = new Sphere([-4, 1, 0], 1, material2);
  spheres.push(sphere2);
  const material3 = new MetalMaterial(new Color(0.7, 0.6, 0.5), 0.0);
  const sphere3 = new Sphere([4, 1, 0], 1, material3);
  spheres.push(sphere3);

  return spheres;
}

function buildSpheresArray(): Sphere[] {
  return buildFinalSceneSpheresArray();
}

function writeSpheresToBuffer(device: any, spheres: Sphere[]) {
  const sphereData = spheres.flatMap(sphere => sphere.getSphere());
  const sphereBuffer = device.createBuffer({
    size: sphereData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sphereBuffer, 0, new Float32Array(sphereData));
  return sphereBuffer;
}

function configureAndWriteCameraToBuffer(device:any) {
  // Camera: vec3 position, vec3 rotation (each f32 = 4 bytes, 6 floats = 24 bytes)
  // WGSL std140 alignment: each vec3 is padded to 16 bytes, so total 32 bytes
  const lookFrom = [13, 2, 3]; // camera position
  const lookAt = [0, 0, 0]; // camera forward
  const vup = [0, 1, 0]; // camera up
  const camera = new Camera(lookFrom, lookAt, vup);
  camera.vfov = 20.0 * (Math.PI / 180.0); // vertical field of view in radians
  camera.defocus_angle = 0.6 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
  camera.focus_dist = 10.0; // distance from camera lookFrom point to plane of perfect focus
  const cameraData = new Float32Array(camera.getCamera());
  const cameraBuffer = device.createBuffer({
    size: cameraData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);
  return cameraBuffer;
}

// Types are inferred from the browser, so no need to import from 'webgpu-types'.
export async function render(device: any, context: any) {
  // Define the maximum number of frames to render
  const MAX_FRAMES = 500; // Set your desired frame limit here

  // Load WGSL shader from external file
  const shaderCode = await fetch('/src/webgpu/shader.wgsl').then(res => res.text());
  const shaderModule = device.createShaderModule({ code: shaderCode });

  // Create uniform buffer for canvas size
  const canvas = context.canvas as HTMLCanvasElement;
  const canvasSize = new Float32Array([canvas.width, canvas.height]);
  const uniformBuffer = device.createBuffer({
    size: 8, // 2 floats (4 bytes each)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, canvasSize.buffer, canvasSize.byteOffset, canvasSize.byteLength);

  const cameraBuffer = configureAndWriteCameraToBuffer(device);

  // Create uniform buffer for frame/time
  // FrameTime: u32 frame, f32 time (4 + 4 = 8 bytes, but std140 alignment pads to 16 bytes)
  let frame = 0;
  let time = 0;
  const frameTimeData = new Float32Array([frame, time, 0, 0]); // pad to 16 bytes
  const frameTimeBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);

  // --- Spheres setup ---
  // Each sphere: vec3 center (3 floats), f32 radius (1 float), vec3 color (3 floats), f32 diffuse (1 float), f32 specular (1 float), f32 padding (1 float) = 12 floats (48 bytes) per sphere
  // Example: two spheres with materials
  const spheres = buildSpheresArray();
  const spheresBuffer = writeSpheresToBuffer(device, spheres);
  // Uniform buffer for number of spheres (u32, padded to 4 bytes)
  const numSpheresBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(numSpheresBuffer, 0, new Uint32Array([spheres.length]));

  // --- RenderSettings uniform buffer ---
  // struct RenderSettings { num_samples: u32, num_bounces: u32 }
  const numSamplesSqrt = 1; // You can set this to any value you want
  const numBounces = 10; // You can set this to any value you want
  const renderSettingsData = new Uint32Array([numSamplesSqrt, numBounces]);
  const renderSettingsBuffer = device.createBuffer({
    size: 8, // 2 * 4 bytes (u32)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(renderSettingsBuffer, 0, renderSettingsData.buffer, renderSettingsData.byteOffset, renderSettingsData.byteLength);

  // --- Accumulation textures and sampler setup ---
  // Create two textures for ping-pong accumulation
  const textureDesc = {
    size: [canvas.width, canvas.height, 1],
    format: 'rgba16float',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST,
  };
  const accumTextureA = device.createTexture(textureDesc);
  const accumTextureB = device.createTexture(textureDesc);
  let ping = accumTextureA;
  let pong = accumTextureB;
  const accumSampler = device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });

  // Update bind group layout and bind group to include previous frame texture and sampler
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: 2, // GPUShaderStage.FRAGMENT = 2
        buffer: { type: 'uniform' },
      },
      {
        binding: 1,
        visibility: 2, // GPUShaderStage.FRAGMENT = 2
        buffer: { type: 'uniform' },
      },
      {
        binding: 2,
        visibility: 2, // GPUShaderStage.FRAGMENT = 2
        buffer: { type: 'uniform' },
      },
      {
        binding: 3,
        visibility: 2, // GPUShaderStage.FRAGMENT
        buffer: { type: 'read-only-storage' },
      },
      {
        binding: 4,
        visibility: 2, // GPUShaderStage.FRAGMENT
        buffer: { type: 'uniform' },
      },
      {
        binding: 5,
        visibility: 2, // GPUShaderStage.FRAGMENT
        buffer: { type: 'uniform' },
      },
      {
        binding: 6,
        visibility: 2, // GPUShaderStage.FRAGMENT
        texture: { sampleType: 'unfilterable-float' },
      },
      {
        binding: 7,
        visibility: 2, // GPUShaderStage.FRAGMENT
        sampler: { type: 'non-filtering' },
      },
    ],
  });

  // Animation loop to update frame/time and render
  let startTime = performance.now();
  let animationFrameId: number;

  // Create two pipelines: one for accumulation (rgba16float), one for blitting (canvas format)
  const accumPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format: 'rgba16float' }],
    },
    primitive: { topology: 'triangle-list' },
  });
  const blitPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format: context.getCurrentTexture().format || 'bgra8unorm' }],
    },
    primitive: { topology: 'triangle-list' },
  });

  function frameLoop() {
    const now = performance.now();
    frame += 1;
    time = (now - startTime) * 0.001;
    frameTimeData[0] = frame;
    frameTimeData[1] = time;
    device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);

    // Re-create bindGroup with the current ping as previous frame texture
    const dynamicBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: cameraBuffer } },
        { binding: 2, resource: { buffer: frameTimeBuffer } },
        { binding: 3, resource: { buffer: spheresBuffer } },
        { binding: 4, resource: { buffer: numSpheresBuffer } },
        { binding: 5, resource: { buffer: renderSettingsBuffer } },
        { binding: 6, resource: ping.createView() },
        { binding: 7, resource: accumSampler },
      ],
    });

    // Render to pong (accumulation texture)
    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: pong.createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: frame === 1 ? 'clear' : 'load',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(accumPipeline);
    renderPass.setBindGroup(0, dynamicBindGroup);
    renderPass.draw(3, 1, 0, 0);
    renderPass.end();
    // Copy/blit pong to the canvas
    const textureView = context.getCurrentTexture().createView();
    const blitPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          loadOp: 'clear',
          storeOp: 'store',
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
      ],
    });
    blitPass.setPipeline(blitPipeline);
    blitPass.setBindGroup(0, dynamicBindGroup);
    blitPass.draw(3, 1, 0, 0);
    blitPass.end();
    device.queue.submit([encoder.finish()]);
    // Wait for GPU to finish before next frame
    device.queue.onSubmittedWorkDone().then(() => {
      [ping, pong] = [pong, ping];
      if (frame < MAX_FRAMES) {
        animationFrameId = requestAnimationFrame(frameLoop);
      }
      // If frame >= MAX_FRAMES, do not schedule another frame
    });
  }
  frameLoop();

  // Return a cleanup function
  return () => cancelAnimationFrame(animationFrameId);
}
