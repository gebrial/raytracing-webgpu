// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

class Color {
  private r: number;
  private g: number;
  private b: number;
  private a: number;

  constructor(r: number, g: number, b: number, a: number = 1.0) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  getColor(): number[] {
    return [this.r, this.g, this.b, this.a];
  }
  setColor(r: number, g: number, b: number, a: number = 1.0) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}

class Material {
  protected color: Color;
  protected diffuse: number;
  protected specular: number;
  protected fuzz: number = 0.0;
  protected refractionIndex: number = 1.0;

  constructor(color: Color, diffuse: number, specular: number, fuzz: number = 0.0, refractionIndex: number = 1.0) {
    this.color = color;
    this.diffuse = diffuse;
    this.specular = specular;
    // refraction chance = 1 - diffuse - specular
    this.fuzz = fuzz;
    this.refractionIndex = refractionIndex;
  }

  getMaterial(): number[] {
    return [
      ...this.color.getColor(),
      this.diffuse,
      this.specular,
      this.fuzz,
      this.refractionIndex,
    ];
  }
}

class LambertianMaterial extends Material {
  constructor(color: Color) {
    const diffuse = 1.0; // Lambertian materials have a diffuse value of 1.0
    super(color, diffuse, 1.0 - diffuse);
  }
}

class MetalMaterial extends Material {
  constructor(color: Color, fuzz: number) {
    const diffuse = 0.0; // Metal materials have a diffuse value of 0.0
    super(color, diffuse, 1.0 - diffuse, fuzz);
  }
}

class DielectricMaterial extends Material {
  constructor(refractionIndex: number) {
    super(new Color(1.0, 1.0, 1.0), 0.0, 0.0, 0.0, refractionIndex);
  }
}

class Sphere {
  private center: number[];
  private radius: number;
  private material: Material;

  constructor(center: number[], radius: number, material: Material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }

  getSphere(): number[] {
    return [
      ...this.center,
      this.radius,
      ...this.material.getMaterial(),
    ];
  }
}

function buildSpheresArray(): Sphere[] {
  const material_ground = new LambertianMaterial(new Color(0.8, 0.8, 0.0)); // yellow
  const material_center = new LambertianMaterial(new Color(0.1, 0.2, 0.5)); // blue-ish
  const material_left = new DielectricMaterial(1.50); // glass
  const material_bubble = new DielectricMaterial(1.0 / 1.5); // air inside glass
  const material_right = new MetalMaterial(new Color(0.8, 0.6, 0.2), 1.0); // yellow-ish

  return [
    new Sphere([0.0, -100.5, -1.0], 100.0, material_ground),
    new Sphere([0.0, 0.0, -1.2], 0.5, material_center),
    new Sphere([-1.0, 0.0, -1.0], 0.5, material_left),
    new Sphere([-1.0, 0.0, -1.0], 0.4, material_bubble), // air inside glass ball
    new Sphere([1.0, 0.0, -1.0], 0.5, material_right),
  ];
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
  const cameraPosition = [0, 0, 0]; // camera position
  const cameraForward = [0, 0, 1]; // camera rotation
  const cameraUp = [0, 1, 0]; // camera forward
  const cameraData = new Float32Array([
    ...cameraPosition, 0, // pad to 4 floats
    ...cameraForward, 0, // pad to 4 floats
    ...cameraUp, 0, // pad to 4 floats
  ]);
  const cameraBuffer = device.createBuffer({
    size: 48, // 2 vec4s (16 bytes each)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);
  return cameraBuffer;
}

// Types are inferred from the browser, so no need to import from 'webgpu-types'.
export async function render(device: any, context: any) {
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

  // Update bind group layout and bind group to include spheres and count
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
    ],
  });
  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      {
        binding: 0,
        resource: { buffer: uniformBuffer },
      },
      {
        binding: 1,
        resource: { buffer: cameraBuffer },
      },
      {
        binding: 2,
        resource: { buffer: frameTimeBuffer },
      },
      {
        binding: 3,
        resource: { buffer: spheresBuffer },
      },
      {
        binding: 4,
        resource: { buffer: numSpheresBuffer },
      },
    ],
  });

  // Animation loop to update frame/time and render
  let startTime = performance.now();
  let animationFrameId: number;
  function frameLoop() {
    const now = performance.now();
    frame += 1;
    time = (now - startTime) * 0.001;
    frameTimeData[0] = frame;
    frameTimeData[1] = time;
    device.queue.writeBuffer(frameTimeBuffer, 0, frameTimeData.buffer, frameTimeData.byteOffset, frameTimeData.byteLength);

    const pipeline = device.createRenderPipeline({
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

    const encoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();
    const renderPass = encoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        },
      ],
    });
    renderPass.setPipeline(pipeline);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(3, 1, 0, 0); // fullscreen triangle
    renderPass.end();
    device.queue.submit([encoder.finish()]);

    // animationFrameId = requestAnimationFrame(frameLoop);
  }
  frameLoop();

  // Return a cleanup function
  // return () => cancelAnimationFrame(animationFrameId);
}
