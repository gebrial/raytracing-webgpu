@group(0) @binding(0) var<uniform> uCanvas: CanvasSize;
@group(0) @binding(1) var<uniform> uCamera: Camera;
@group(0) @binding(2) var<uniform> uFrameTime: FrameTime;
@group(0) @binding(3) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(4) var<uniform> uNumSpheres: u32;
@group(0) @binding(5) var<uniform> uRenderSettings: RenderSettings;
@group(0) @binding(6) var<storage, read_write> accumBuffer: AccumBuffer;
