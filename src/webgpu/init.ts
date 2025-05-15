// src/webgpu/init.ts
// Initializes WebGPU and returns the device, context, and format

export async function initWebGPU(canvas: HTMLCanvasElement) {
  // @ts-ignore: WebGPU types may not be present in default TS lib
  if (!(navigator as any).gpu) {
    throw new Error('WebGPU is not supported in this browser.');
  }

  // @ts-ignore
  const adapter = await (navigator as any).gpu.requestAdapter();
  if (!adapter) {
    throw new Error('Failed to get GPU adapter.');
  }

  // @ts-ignore
  const device = await adapter.requestDevice();
  // @ts-ignore
  const context = canvas.getContext('webgpu');
  if (!context) {
    throw new Error('Failed to get WebGPU context from canvas.');
  }
  // @ts-ignore
  const format = (navigator as any).gpu.getPreferredCanvasFormat();

  // @ts-ignore
  context.configure({
    device,
    format,
    alphaMode: 'opaque',
  });

  return { device, context, format };
}
