// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

import { Color } from './color';
import { LambertianMaterial } from './material';
import { Sphere, type BoundingBox } from './sphere';
import { Vec3 } from './vec3';
import { Quadrilateral } from './quadrilateral';
import { BVHNode } from './boundVolumeHierarchy';
import { BasicScene, FinalScene, type Scene } from './scene';


// constants
const NUM_SAMPLES_SQRT = 4; // You can set this to any value you want
const NUM_BOUNCES = 10; // You can set this to any value you want
const SINGLE_IMAGE = !false; // Set to true if you want to accumulate color over frames or false for a video
const MAX_FRAMES = SINGLE_IMAGE ? 50 : 5000; // Set your desired frame limit here
const SCENARIO = 0;

function getScene(scenario: number): Scene {
  switch (scenario) {
    case 0:
      return new FinalScene();
    case 1:
      return new BasicScene();
    default:
      throw new Error(`Unknown scenario: ${scenario}`);
  }
}

function writeQuadsToBuffer(device: any, quads: Quadrilateral[]) {
  if (!quads || quads.length === 0) {
    // make dummy quad if no quads are provided
    const dummyMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
    const dummyQuad = new Quadrilateral(
      new Vec3(0, 0, 0), // corner
      new Vec3(0, 0, 0), // u vector
      new Vec3(0, 0, 0), // v vector
      dummyMaterial
    );
    quads = [dummyQuad];
  }
  const quadData = quads.flatMap(quad => quad.getQuadrilateral());
  const quadBuffer = device.createBuffer({
    size: quadData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(quadBuffer, 0, new Float32Array(quadData));
  return quadBuffer;
}

function writeSpheresToBuffer(device: any, spheres: Sphere[]) {
  if (!spheres || spheres.length === 0) {
    // make dummy sphere if no spheres are provided
    const dummyMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
    const dummySphere = new Sphere(new Vec3(0, 0, 0), 0, dummyMaterial);
    spheres = [dummySphere];
  }
  const sphereData = spheres.flatMap(sphere => sphere.getSphere());
  const sphereBuffer = device.createBuffer({
    size: sphereData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(sphereBuffer, 0, new Float32Array(sphereData));
  return sphereBuffer;
}

// Load WGSL shader from multiple modules and concatenate in the correct order
async function createShaderModule(device: any) {
  const shaderFiles = [
    '/src/webgpu/shaders/common.wgsl',
    '/src/webgpu/shaders/interval.wgsl',
    '/src/webgpu/shaders/geometry.wgsl',
    '/src/webgpu/shaders/random.wgsl',
    '/src/webgpu/shaders/camera.wgsl',
    '/src/webgpu/shaders/hit.wgsl',
    '/src/webgpu/shaders/raytracing.wgsl',
    '/src/webgpu/shaders/entry.wgsl',
    '/src/webgpu/shaders/bindings.wgsl',
    '/src/webgpu/shaders/bvhnode.wgsl',
  ];
  const shaderCode = (await Promise.all(shaderFiles.map(f => fetch(f).then(res => res.text())))).join('\n');
  return device.createShaderModule({ code: shaderCode });
}

function createAndWriteImageBuffers(device: any, canvas: HTMLCanvasElement) {
  const canvasSize = new Float32Array([canvas.width, canvas.height]);
  const uniformBuffer = device.createBuffer({
    size: canvasSize.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, canvasSize.buffer, canvasSize.byteOffset, canvasSize.byteLength);

  const pixelCount = canvas.width * canvas.height;
  const accumBuffer = device.createBuffer({
    size: pixelCount * 4 * 4, // 4 floats (RGBA) per pixel, 4 bytes per float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });
  return {
    uniformBuffer,
    accumBuffer
  };
}

function createAndWriteCameraBuffer(device: any, scene: Scene) {
  let cameraData = scene.getCameraData();
  const cameraBuffer = device.createBuffer({
    size: cameraData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);
  return cameraBuffer;
}

function createAndWriteFrameTimeBuffer(device: any) {
  const frameTimeData = new Float32Array([0, 0, 0, 0]); // pad to 16 bytes
  const frameTimeBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);
  return frameTimeBuffer;
}

function createAndWriteObjectBuffers(device: any, objects: BoundingBox[]) {
  const spheresArray = objects.filter(obj => obj instanceof Sphere) as Sphere[];
  const quadsArray = objects.filter(obj => obj instanceof Quadrilateral) as Quadrilateral[];

  const bvh = new BVHNode(objects.map((obj, index) => {
    const indexInSpheres = spheresArray.indexOf(obj as Sphere);
    const indexInQuads = quadsArray.indexOf(obj as Quadrilateral);
    if (indexInSpheres !== -1) {
      return { index: indexInSpheres, object: obj };
    }
    if (indexInQuads !== -1) {
      return { index: indexInQuads, object: obj };
    }

    throw new Error('Object is neither a Sphere nor a Quadrilateral');
  }));
  const bvhNodesData = BVHNode.getAllNodesData(bvh);
  const spheresBuffer = writeSpheresToBuffer(device, spheresArray);
  // Uniform buffer for number of spheres (u32, padded to 4 bytes)
  const numSpheresBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(numSpheresBuffer, 0, new Uint32Array([spheresArray.length]));

  // --- Quads setup ---
  const quadsBuffer = writeQuadsToBuffer(device, quadsArray);

  // --- BVH Nodes buffer setup ---
  // Each BVHNode: min (vec3) + f32, max (vec3) + f32, 4x u32 = 12 floats (48 bytes) per node
  const bvhNodesBuffer = device.createBuffer({
    size: bvhNodesData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(bvhNodesBuffer, 0, new Float32Array(bvhNodesData));
  // Uniform buffer for number of BVH nodes (u32, padded to 4 bytes)
  const numBvhNodesBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(numBvhNodesBuffer, 0, new Uint32Array([bvhNodesData.length / bvh.getNodeData().length]));

  return {
    spheresBuffer,
    numSpheresBuffer,
    quadsBuffer,
    bvhNodesBuffer,
    numBvhNodesBuffer,
  };
}

function createAndWriteRenderSettingsBuffer(device: any) {
  const renderSettingsData = new Uint32Array([
    NUM_SAMPLES_SQRT,
    NUM_BOUNCES,
    SINGLE_IMAGE ? 1 : 0, 
    Math.random() * (2 ** 32 - 1), // random seed
    SCENARIO, // 0 for black background, 1 for blue sky
  ]);
  const renderSettingsBuffer = device.createBuffer({
    size: renderSettingsData.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(renderSettingsBuffer, 0, renderSettingsData.buffer, renderSettingsData.byteOffset, renderSettingsData.byteLength);
  return renderSettingsBuffer;
}


export async function render(device: any, context: any) {
  const shaderModule = await createShaderModule(device);

  // Create uniform buffer for canvas
  // Create a storage buffer for accumulating color per pixel (width * height * 4 floats)
  const canvas = context.canvas as HTMLCanvasElement;
  const { uniformBuffer, accumBuffer } = createAndWriteImageBuffers(device, canvas);

  const scene = getScene(SCENARIO);
  const cameraBuffer = createAndWriteCameraBuffer(device, scene);

  // Create uniform buffer for frame/time
  const frameTimeBuffer = createAndWriteFrameTimeBuffer(device);

  // --- Spheres setup ---
  // Each sphere: vec3 center (3 floats), f32 radius (1 float), vec3 color (3 floats), f32 diffuse (1 float), f32 specular (1 float), f32 padding (1 float) = 12 floats (48 bytes) per sphere
  // Example: two spheres with materials
  const objects = scene.getObjectsArray();
  const { spheresBuffer, numSpheresBuffer, quadsBuffer, bvhNodesBuffer, numBvhNodesBuffer } = createAndWriteObjectBuffers(device, objects);

  // --- RenderSettings uniform buffer ---
  const renderSettingsBuffer = createAndWriteRenderSettingsBuffer(device);

  // Update bind group layout and bind group to include accumulation buffer instead of previous frame texture/sampler
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: 2, buffer: { type: 'uniform' } },
      { binding: 1, visibility: 2, buffer: { type: 'uniform' } },
      { binding: 2, visibility: 2, buffer: { type: 'uniform' } },
      { binding: 3, visibility: 2, buffer: { type: 'read-only-storage' } },
      { binding: 4, visibility: 2, buffer: { type: 'uniform' } },
      { binding: 5, visibility: 2, buffer: { type: 'uniform' } },
      { binding: 6, visibility: 2, buffer: { type: 'storage' } }, // accumulation buffer (read-write)
      { binding: 7, visibility: 2, buffer: { type: 'read-only-storage' } }, // BVH nodes
      { binding: 8, visibility: 2, buffer: { type: 'uniform' } }, // num BVH nodes
      { binding: 9, visibility: 2, buffer: { type: 'read-only-storage' } }, // quads
    ],
  });

  // Create pipeline for accumulation (canvas format)
  const canvasFormat = context.getCurrentTexture().format || 'bgra8unorm';
  const accumPipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{ format: canvasFormat }],
    },
    primitive: { topology: 'triangle-list' },
  });

  function randomSeed(min: number, max: number) {
    return Math.random() * (max - min + 1) + min;
  }

  let animationFrameId: number;

  // Animation loop to update frame/time and render
  let startTime = performance.now();
  let frame = 0;
  function frameLoop() {
    const now = performance.now();
    const time = (now - startTime) * 0.001;
    const frameTimeData = new Float32Array([frame, time, 0, 0]); // pad to 16 bytes
    device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);
    frame += 1;

    // Update camera buffer with current time
    const cameraData = scene.getCameraData(SINGLE_IMAGE ? 8.45 : time);
    device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);

    // approximate magic numbers from trial and error
    let minRandom = 1147066390.0;
    let maxRandom = 1312701008.0;
    let random_seed = randomSeed(minRandom, maxRandom);
    // update render settings buffer with new random seed
    const renderSettingsData = new Uint32Array([
      NUM_SAMPLES_SQRT,
      NUM_BOUNCES,
      SINGLE_IMAGE ? 1 : 0,
      random_seed, // random seed
      SCENARIO, // 0 for black background, 1 for blue sky
    ]);
    device.queue.writeBuffer(renderSettingsBuffer, 0, renderSettingsData.buffer, renderSettingsData.byteOffset, renderSettingsData.byteLength);

    // Re-create bindGroup with the current accumulation buffer
    const dynamicBindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: cameraBuffer } },
        { binding: 2, resource: { buffer: frameTimeBuffer } },
        { binding: 3, resource: { buffer: spheresBuffer } },
        { binding: 4, resource: { buffer: numSpheresBuffer } },
        { binding: 5, resource: { buffer: renderSettingsBuffer } },
        { binding: 6, resource: { buffer: accumBuffer } },
        { binding: 7, resource: { buffer: bvhNodesBuffer } },
        { binding: 8, resource: { buffer: numBvhNodesBuffer } },
        { binding: 9, resource: { buffer: quadsBuffer } },
      ],
    });

    // Render to canvas
    const encoder = device.createCommandEncoder();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: context.getCurrentTexture().createView(),
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
    device.queue.submit([encoder.finish()]);
    // Wait for GPU to finish before next frame
    device.queue.onSubmittedWorkDone().then(() => {
      if (frame < MAX_FRAMES) {
        animationFrameId = requestAnimationFrame(frameLoop);
        // console log frame rate
        if (frame % 10 === 0) {
          const elapsedTime = (performance.now() - startTime) / 1000;
          const fps = frame / elapsedTime;
          console.log(`Frame: ${frame}, FPS: ${fps.toFixed(2)}`);
        }
      }
      // If frame >= MAX_FRAMES, do not schedule another frame
    });
  }
  frameLoop();

  // Return a cleanup function
  return () => cancelAnimationFrame(animationFrameId);
}
