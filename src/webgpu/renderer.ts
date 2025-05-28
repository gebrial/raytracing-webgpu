// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

import { Color } from './color';
import { LambertianMaterial, MetalMaterial, DielectricMaterial, GlossyMaterial, EmissiveMaterial } from './material';
import { Sphere, type BoundingBox } from './sphere';
import { Camera } from './camera';
import { Vec3 } from './vec3';
import { Quadrilateral } from './quadrilateral';


// constants
const numSamplesSqrt = 4; // You can set this to any value you want
const numBounces = 10; // You can set this to any value you want
const ACCUMULATE_COLOR = !false; // Set to true if you want to accumulate color over frames or false for a video
const MAX_FRAMES = ACCUMULATE_COLOR ? 500 : 5000; // Set your desired frame limit here

function buildBasicSceneObjectsArray(): BoundingBox[] {
  const objects: BoundingBox[] = [];

  const materialGround = new LambertianMaterial(new Color(0.8, 0.8, 0.0));
  const materialCenter = new LambertianMaterial(new Color(0.1, 0.2, 0.5));
  const materialLeft = new DielectricMaterial(1.5);
  const materialBubble = new DielectricMaterial(1.0 / 1.5);
  const materialRight = new MetalMaterial(new Color(0.8, 0.6, 0.2), 0.0);

  objects.push(
    new Sphere(new Vec3(0, -100.5, -1.0), 100.0, materialGround),
    new Sphere(new Vec3(0, 0, -1.2), 0.5, materialCenter),
    new Sphere(new Vec3(-1.0, 0, -1.0), 0.5, materialLeft),
    new Sphere(new Vec3(-1.0, 0, -1.0), 0.4, materialBubble),
    new Sphere(new Vec3(1.0, 0, -1.0), 0.5, materialRight)
  );

  return objects;
}

function buildFinalSceneObjectsArray(): BoundingBox[] {
  const objects: BoundingBox[] = [];

  const groundMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
  const groundQuad = new Quadrilateral(
    new Vec3(-100, 0, -100), // corner
    new Vec3(200, 0, 0), // u vector
    new Vec3(0, 0, 200), // v vector
    groundMaterial
  );
  objects.push(groundQuad);

  const sunMaterial = new EmissiveMaterial(new Color(1, 1, 1), 5);
  const sunYAngle = 41.8 * (Math.PI / 180.0); // angle so that parallel rays cause glass spheres to focus light on ground
  const sunDistance = 2000;
  const sunHeight = Math.tan(sunYAngle) * sunDistance;
  const sunXZAngle = 1;
  var sunRadius =  sunDistance * 695700.0 / 149600000.0; // real sun apparent size
  sunRadius *= 30; // scale up the sun radius to be visible in the scene
  const sunPosition = new Vec3(sunDistance * Math.cos(sunXZAngle), sunHeight, -sunDistance * Math.sin(sunXZAngle));
  const sunSphere = new Sphere(sunPosition, sunRadius, sunMaterial);

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
      objects.push(sphere);
    }
  }

  const material1 = new DielectricMaterial(1.5);
  const sphere1 = new Sphere(new Vec3(0, 1, 0), 1, material1);
  objects.push(sphere1);
  const material2 = new LambertianMaterial(new Color(0.4, 0.2, 0.1));
  const sphere2 = new Sphere(new Vec3(-4, 1, 0), 1, material2);
  objects.push(sphere2);
  const material3 = new MetalMaterial(new Color(0.7, 0.6, 0.5), 0.0);
  const sphere3 = new Sphere(new Vec3(4, 1, 0), 1, material3);
  objects.push(sphere3);
  objects.push(sunSphere);

  return objects;
}


const SCENARIO = 1;
function buildSpheresArray(scenario: number): BoundingBox[] {
  switch (scenario) {
    case 0:
      return buildFinalSceneObjectsArray();
    case 1:
      return buildBasicSceneObjectsArray();
    default:
      throw new Error('Invalid scenario');
  }
}

function configureCameraData(scenario: number, time: number): Float32Array {
  switch (scenario) {
    case 0:
      return configureCameraDataFinalScene(time);
    case 1:
      return configureCameraDataBasicScene();
    default:
      throw new Error('Invalid scenario');
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

class BVHNode {
  private min: Vec3;
  private max: Vec3;
  private left: BVHNode | null = null;
  private right: BVHNode | null = null;
  private primitiveIndex: number = -1;
  private primitiveType: number = -1;
  private isLeaf: boolean;
  public thisIndex: number = 0;

  constructor(primitives: {index: number, object: BoundingBox}[]) {
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

    function getBoundingBox(primitives: BoundingBox[]): { min: Vec3; max: Vec3 } {
      let min = new Vec3(Infinity, Infinity, Infinity);
      let max = new Vec3(-Infinity, -Infinity, -Infinity);
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives[i];
        const sphereMin = primitive.getBoundingBoxMin();
        const sphereMax = primitive.getBoundingBoxMax();
        min = Vec3.min(min, sphereMin);
        max = Vec3.max(max, sphereMax);
      }
      return { min, max };
    }

    const { min, max } = getBoundingBox(primitives.map(s => s.object));
    let axis = getLongestAxis(min, max);

    const objectSpan = primitives.length;
    if (objectSpan === 1) {
      this.primitiveIndex = primitives[0].index;
      this.primitiveType = primitives[0].object.primitiveType;
      this.isLeaf = true;
      this.min = primitives[0].object.getBoundingBoxMin();
      this.max = primitives[0].object.getBoundingBoxMax();
    } else if (objectSpan === 2) {
      this.left = new BVHNode([primitives[0]]);
      this.right = new BVHNode([primitives[1]]);
      this.isLeaf = false;
      this.min = Vec3.min(this.left.min, this.right.min);
      this.max = Vec3.max(this.left.max, this.right.max);
    } else {
      // sort spheres along the chosen axis
      // based on min value of the bounding box
      primitives.sort((a, b) => {
        const aMin = a.object.getBoundingBoxMin().at(axis);
        const bMin = b.object.getBoundingBoxMin().at(axis);
        return aMin - bMin;
      });

      const mid = Math.floor(objectSpan / 2);
      this.left = new BVHNode(primitives.slice(0, mid));
      this.right = new BVHNode(primitives.slice(mid, objectSpan));
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
      ...this.max.getVec3(), this.primitiveType, // padding to 4 floats
      this.left?.thisIndex || 0, this.right?.thisIndex || 0,
      this.primitiveIndex,
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

function configureCameraDataBasicScene(): Float32Array {
  // Basic scene camera configuration
  const lookFrom = new Vec3(0, 0, 0); // camera position
  const lookAt = new Vec3(0, 0, -1); // point to look at
  const vup = new Vec3(0, 1, 0); // up vector
  const camera = new Camera(lookFrom, lookAt, vup);
  camera.vfov = 90.0 * (Math.PI / 180.0); // vertical field of view in radians
  camera.defocus_angle = 0.0 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
  camera.focus_dist = lookFrom.distanceTo(lookAt); // distance from camera lookFrom point to plane of perfect focus
  return new Float32Array(camera.getCamera());
}

// time in seconds
function configureCameraDataFinalScene(time: number = 8.45): Float32Array {
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
  let cameraData = configureCameraData(SCENARIO);
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
  const objects = buildSpheresArray(SCENARIO);
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
      { binding: 9, visibility: 2, buffer: { type: 'read-only-storage' } }, // quads
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
    cameraData = configureCameraData(SCENARIO, ACCUMULATE_COLOR ? 8.45 : time);
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
