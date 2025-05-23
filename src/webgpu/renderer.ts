// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

import { Color } from './color';
import { LambertianMaterial, MetalMaterial, DielectricMaterial, GlossyMaterial, EmissiveMaterial } from './material';
import { Sphere } from './sphere';
import { Camera } from './camera';
import { Vec3 } from './vec3';


// constants
const numSamplesSqrt = 4; // You can set this to any value you want
const numBounces = 10; // You can set this to any value you want
const ACCUMULATE_COLOR = !false; // Set to true if you want to accumulate color over frames or false for a video
const MAX_FRAMES = ACCUMULATE_COLOR ? 500 : 5000; // Set your desired frame limit here


function buildFinalSceneSpheresArray(): Sphere[] {
  const spheres: Sphere[] = [];

  const groundSphereRadius = 10000;
  const groundMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
  const groundSphere = new Sphere(new Vec3(0, -groundSphereRadius, 0), groundSphereRadius, groundMaterial);
  spheres.push(groundSphere);

  const sunMaterial = new EmissiveMaterial(new Color(1, 1, 1), 5);
  const sunYAngle = 41.8 * (Math.PI / 180.0); // angle so that parallel rays cause glass spheres to focus light on ground
  const sunDistance = 2000;
  const sunHeight = Math.tan(sunYAngle) * sunDistance;
  const sunXZAngle = 1;
  var sunRadius =  sunDistance * 695700.0 / 149600000.0; // real sun apparent size
  sunRadius *= 30; // scale up the sun radius to be visible in the scene
  const sunPosition = new Vec3(sunDistance * Math.cos(sunXZAngle), sunHeight, -sunDistance * Math.sin(sunXZAngle));
  const sunSphere = new Sphere(sunPosition, sunRadius, sunMaterial);
  spheres.push(sunSphere);

  for (let i = -111; i < 111; i++) {
    for (let j = -111; j < 111; j++) {
      const materialType = Math.random();
      const center = new Vec3(i + 0.9 * Math.random(), 0.2, j + 0.9 * Math.random());
      const nearMetalBall = new Vec3(4, 0.2, 0);
      const distance = center.distanceTo(nearMetalBall);
      if (distance < 0.9) {
        continue; // Skip this sphere if it's too close to the metal ball
      }
      let material: any;

      if (materialType < 0.2) {
        // emissive
        const albedo = new Color(Math.random(), Math.random(), Math.random());
        material = new EmissiveMaterial(albedo, Math.random() * 2.0);
      } else if (materialType < 0.4) {
        // glossy
        const fuzz = Math.random() * 0.5;
        const albedo = new Color(Math.random() * Math.random(), Math.random() * Math.random(), Math.random() * Math.random());
        material = new GlossyMaterial(albedo, fuzz, Math.random() * 0.5 + 0.25);
      } else if (materialType < 0.8) {
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
  const sphere1 = new Sphere(new Vec3(0, 1, 0), 1, material1);
  spheres.push(sphere1);
  const material2 = new LambertianMaterial(new Color(0.4, 0.2, 0.1));
  const sphere2 = new Sphere(new Vec3(-4, 1, 0), 1, material2);
  spheres.push(sphere2);
  const material3 = new MetalMaterial(new Color(0.7, 0.6, 0.5), 0.0);
  const sphere3 = new Sphere(new Vec3(4, 1, 0), 1, material3);
  spheres.push(sphere3);

  return spheres;
}


const SCENARIO = 0;
function buildSpheresArray(scenario: number): Sphere[] {
  switch (scenario) {
    case 0:
      return buildFinalSceneSpheresArray();
    default:
      throw new Error('Invalid scenario');
  }
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

class BVHNode {
  private min: Vec3;
  private max: Vec3;
  private left: BVHNode | null = null;
  private right: BVHNode | null = null;
  private sphereIndex: number = 0;
  private isLeaf: boolean;
  public thisIndex: number = 0;

  constructor(spheres: Sphere[], start: number = 0, end: number = spheres.length) {
    function getLongestAxis(min: Vec3, max: Vec3): number {
      const xSpan = max.x - min.x;
      const ySpan = max.y - min.y;
      const zSpan = max.z - min.z;
      if (xSpan >= ySpan && xSpan >= zSpan) {
        return 0; // x-axis
      } else if (ySpan >= xSpan && ySpan >= zSpan) {
        return 1; // y-axis
      } else {
        return 2; // z-axis
      }
    }

    function getBoundingBox(spheres: Sphere[]): { min: Vec3; max: Vec3 } {
      let min = new Vec3(Infinity, Infinity, Infinity);
      let max = new Vec3(-Infinity, -Infinity, -Infinity);
      for (let i = 0; i < spheres.length; i++) {
        const sphere = spheres[i];
        const sphereMin = sphere.getBoundingBoxMin();
        const sphereMax = sphere.getBoundingBoxMax();
        min = Vec3.min(min, sphereMin);
        max = Vec3.max(max, sphereMax);
      }
      return { min, max };
    }

    let spheresInNode = spheres.slice(start, end);

    const { min, max } = getBoundingBox(spheresInNode);
    let axis = getLongestAxis(min, max);

    const objectSpan = end - start;
    if (objectSpan === 1) {
      this.sphereIndex = start;
      this.isLeaf = true;
      this.min = spheresInNode[0].getBoundingBoxMin();
      this.max = spheresInNode[0].getBoundingBoxMax();
    } else if (objectSpan === 2) {
      this.left = new BVHNode(spheres, start, start + 1);
      this.right = new BVHNode(spheres, start + 1, end);
      this.isLeaf = false;
      this.min = Vec3.min(this.left.min, this.right.min);
      this.max = Vec3.max(this.left.max, this.right.max);
    } else {
      // sort spheres along the chosen axis
      // based on min value of the bounding box
      spheresInNode.sort((a, b) => {
        const aMin = a.getBoundingBoxMin().at(axis);
        const bMin = b.getBoundingBoxMin().at(axis);
        return aMin - bMin;
      });
      // add spheres back to list
      for (let i = start; i < end; i++) {
        spheres[i] = spheresInNode[i - start];
      }

      this.left = new BVHNode(spheres, start, start + Math.floor(objectSpan / 2));
      this.right = new BVHNode(spheres, start + Math.floor(objectSpan / 2), end);
      this.isLeaf = false;
      this.min = Vec3.min(this.left.min, this.right.min);
      this.max = Vec3.max(this.left.max, this.right.max);
    }
  }

  getLeftChild(): BVHNode | null {
    return this.left;
  }
  getRightChild(): BVHNode | null {
    return this.right;
  }

  getNodeData(): number[] {
    const nodeData = [
      ...this.min.getVec3(), 0, // padding to 4 floats
      ...this.max.getVec3(), 0, // padding to 4 floats
      this.left?.thisIndex || 0, this.right?.thisIndex || 0,
      this.sphereIndex,
      this.isLeaf ? 1 : 0,
    ];
    return nodeData;
  }

  static collectNodes(node: BVHNode): BVHNode[] {
    const nodes: BVHNode[] = [];
    nodes.push(node);
    if (node.left) {
      nodes.push(...BVHNode.collectNodes(node.left));
    }
    if (node.right) {
      nodes.push(...BVHNode.collectNodes(node.right));
    }
    return nodes;
  }

  static getAllNodesData(node: BVHNode): number[] {
    const nodes: BVHNode[] = BVHNode.collectNodes(node);

    nodes.forEach((n, index) => {
      n.thisIndex = index;
    });

    const nodeData: number[] = [];
    nodes.forEach(n => {
      nodeData.push(...n.getNodeData());
    });
    return nodeData;
  }
}

// time in seconds
function configureCameraData(time: number = 8.45) {
  // const lookFrom = [13, 2, 3]; // camera position

  // rotate camera around origin
  const angle = (time / 40) * Math.PI * 2;
  const radius = Math.sqrt(13 * 13 + 3 * 3);
  const lookFrom = new Vec3(
    radius * Math.sin(angle),
    2,
    radius * Math.cos(angle),
  );
  const lookAt = new Vec3(0, 0, 0);
  const vup = new Vec3(0, 1, 0);
  const camera = new Camera(lookFrom, lookAt, vup);
  camera.vfov = 20.0 * (Math.PI / 180.0);
  camera.defocus_angle = 0.6 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
  camera.focus_dist = 10.0; // distance from camera lookFrom point to plane of perfect focus
  return new Float32Array(camera.getCamera());
}

// Types are inferred from the browser, so no need to import from 'webgpu-types'.
export async function render(device: any, context: any) {
  // Load WGSL shader from multiple modules and concatenate in the correct order
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
  const shaderModule = device.createShaderModule({ code: shaderCode });

  // Create uniform buffer for canvas size
  const canvas = context.canvas as HTMLCanvasElement;
  const canvasSize = new Float32Array([canvas.width, canvas.height]);
  const uniformBuffer = device.createBuffer({
    size: 8, // 2 floats (4 bytes each)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(uniformBuffer, 0, canvasSize.buffer, canvasSize.byteOffset, canvasSize.byteLength);

  // Create camera buffer
  let cameraData = configureCameraData();
  const cameraBuffer = device.createBuffer({
    size: cameraData.length * 4, // 4 bytes per float
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);

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
  const spheres = buildSpheresArray(SCENARIO);
  const bvh = new BVHNode(spheres);
  const bvhNodesData = BVHNode.getAllNodesData(bvh);
  const spheresBuffer = writeSpheresToBuffer(device, spheres);
  // Uniform buffer for number of spheres (u32, padded to 4 bytes)
  const numSpheresBuffer = device.createBuffer({
    size: 4,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(numSpheresBuffer, 0, new Uint32Array([spheres.length]));

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

  // --- RenderSettings uniform buffer ---
  const renderSettingsData = new Uint32Array([
    numSamplesSqrt,
    numBounces,
    ACCUMULATE_COLOR ? 1 : 0, 
    Math.random() * (2 ** 32 - 1), // random seed
  ]);
  const renderSettingsBuffer = device.createBuffer({
    size: 16, // 4 * 4 bytes (u32)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(renderSettingsBuffer, 0, renderSettingsData.buffer, renderSettingsData.byteOffset, renderSettingsData.byteLength);

  // --- Accumulation buffer setup ---
  // Create a storage buffer for accumulating color per pixel (width * height * 3 floats)
  const pixelCount = canvas.width * canvas.height;
  const accumBuffer = device.createBuffer({
    size: pixelCount * 4 * 4, // 4 floats (RGBA) per pixel
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
  });

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
    ],
  });

  // Animation loop to update frame/time and render
  let startTime = performance.now();
  let animationFrameId: number;

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

  function frameLoop() {
    const now = performance.now();
    time = (now - startTime) * 0.001;
    frameTimeData[0] = frame;
    frameTimeData[1] = time;
    device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);
    frame += 1;

    // Update camera buffer with current time
    cameraData = configureCameraData(ACCUMULATE_COLOR ? 8.45 : time);
    device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);

    // approximate magic numbers from trial and error
    let minRandom = 1147066390.0;
    let maxRandom = 1312701008.0;
    let random_seed = randomSeed(minRandom, maxRandom);
    // update render settings buffer with new random seed
    const renderSettingsData = new Uint32Array([
      numSamplesSqrt,
      numBounces,
      ACCUMULATE_COLOR ? 1 : 0,
      random_seed, // random seed
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
