// Vertex and fragment entry points for WGSL shaders

struct AccumBuffer {
  data: array<vec3<f32>>,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let seed = uRenderSettings.random_seed;
  let pixel = vec2<u32>(u32(pos.x), u32(pos.y));
  let resolution = vec2<u32>(u32(uCanvas.size.x), u32(uCanvas.size.y));
  let frame = u32(uFrameTime.frame);
  var rng_state: u32 = initRng(pixel, frame, seed);

  // average over multiple samples
  let samples_sqrt = uRenderSettings.num_samples_sqrt;
  let samples = samples_sqrt * samples_sqrt;
  var color = vec3<f32>(0.0);
  for (var i: u32 = 0u; i < samples; i = i + 1u) {
    let ray = get_ray(pos, &rng_state, i, samples);
    color += ray_color(ray, &rng_state);
  }

  if (uRenderSettings.accumulate_color == 0u) {
    // No color accumulation
    color /= f32(samples);
    color = clamp(color, vec3(0.0), vec3(1.0));
    color = sqrt(color); // gamma correction
    return vec4<f32>(color, 1.0);
  }

  // Accumulate color in buffer
  let idx = u32(pos.y) * u32(uCanvas.size.x) + u32(pos.x);
  let prevColor = accumBuffer.data[idx];
  let totalColor = prevColor + color;
  accumBuffer.data[idx] = totalColor;
  let averageColorClamped = clamp(totalColor / f32(frame + 1) / f32(samples), vec3<f32>(0.0), vec3<f32>(1.0));
  // Output normalized and gamma-corrected color
  let outColor = sqrt(averageColorClamped);
  return vec4<f32>(outColor, 1.0);
}
