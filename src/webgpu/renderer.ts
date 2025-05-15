// src/webgpu/renderer.ts
// Basic renderer that draws a gradient using a fullscreen triangle and a simple WGSL shader

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

  // Create uniform buffer for camera (position + rotation)
  // Camera: vec3 position, vec3 rotation (each f32 = 4 bytes, 6 floats = 24 bytes)
  // WGSL std140 alignment: each vec3 is padded to 16 bytes, so total 32 bytes
  const cameraPosition = [0, 0, 0]; // Example position
  const cameraRotation = [0, 0, 1]; // Example rotation
  const cameraData = new Float32Array([
    ...cameraPosition, 0, // pad to 4 floats
    ...cameraRotation, 0  // pad to 4 floats
  ]);
  const cameraBuffer = device.createBuffer({
    size: 32, // 2 vec4s (16 bytes each)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(cameraBuffer, 0, cameraData.buffer, cameraData.byteOffset, cameraData.byteLength);

  // Create bind group layout and bind group
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
    ],
  });

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
}
