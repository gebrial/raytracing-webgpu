// Common constants and utility functions for WGSL shaders

const RAY_TMAX: f32 = 100000.0;
const INF: f32 = 3.402823466e+38; // Maximum finite f32 value

struct CanvasSize {
  size: vec2<f32>,
};

struct FrameTime {
  frame: f32,
  time: f32,
};

struct RenderSettings {
  num_samples_sqrt: u32,
  num_bounces: u32,
  accumulate_color: u32,
  random_seed: f32,
};
