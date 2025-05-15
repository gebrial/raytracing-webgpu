// src/webgpu/shader.wgsl
// Fullscreen triangle gradient shader

struct CanvasSize {
  size: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uCanvas: CanvasSize;

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

// Random function which returns a number between 0 and 1
fn random(st: vec2<f32>) -> f32 {
    let dot_val = dot(st, vec2<f32>(12.9898, 78.233));
    let sin_val = sin(dot_val);
    return fract(sin_val * 43758.5453123);
}

// define camera position
struct Camera {
  position: vec3<f32>,
  rotation: vec3<f32>,
};
@group(0) @binding(1) var<uniform> uCamera: Camera;

struct FrameTime {
  frame: f32,
  time: f32,
};
@group(0) @binding(2) var<uniform> uFrameTime: FrameTime;

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  // define screen aspect ratio
  let aspect_ratio = uCanvas.size.x / uCanvas.size.y;

  let uv = pos.xy / uCanvas.size;
  // Use frame and time in color output for demonstration
  let t = uFrameTime.time;
  let f = uFrameTime.frame;
  let blue = random(uv + random(vec2<f32>(t, f)));
  return vec4<f32>(uv.x, uv.y, blue, 1.0);
}
