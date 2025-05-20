// Random vector and sampling utilities for WGSL shaders

// returns a random vec3 in the range [0, 1]^3
fn random_vec3(rng_state: ptr<function, u32>) -> vec3<f32> {
  return vec3<f32>(rngNextFloat(rng_state), rngNextFloat(rng_state), rngNextFloat(rng_state));
}

// returns a random vec3 with length 1
fn random_unit_vector(rng_state: ptr<function, u32>) -> vec3<f32> {
  var v = random_vec3(rng_state) * 2.0 - 1.0; // random vec3 in the range [-1, 1]^3
  while (true) {
    let len = length(v);
    if (len > 0.0 && len <= 1.0) {
      break;
    }
    v = random_vec3(rng_state) * 2.0 - 1.0;
  }

  return normalize(v);
}

fn random_on_hemisphere(rng_state: ptr<function, u32>, normal: vec3<f32>) -> vec3<f32> {
  let on_unit_sphere = random_unit_vector(rng_state);
  if (dot(on_unit_sphere, normal) > 0.0) {
    // on the same hemisphere as the normal
    return on_unit_sphere;
  }
  return -on_unit_sphere;
}

fn random_in_unit_disk(rng_state: ptr<function, u32>) -> vec3<f32> {
  var p = vec3<f32>(0.0, 0.0, 0.0);
  while (true) {
    p.x = rngNextFloat(rng_state) * 2.0 - 1.0;
    p.y = rngNextFloat(rng_state) * 2.0 - 1.0;
    if (dot(p, p) < 1.0) {
      break;
    }
  }
  return p;
}

// return a random point in a square
// this is a square in the range [-0.5, 0.5] in x and y
fn sample_square(rng_state: ptr<function, u32>) -> vec2<f32> {
  let x = rngNextFloat(rng_state) - 0.5;
  let y = rngNextFloat(rng_state) - 0.5;
  return vec2<f32>(x, y);
}

fn sample_square_stratified(rng_state: ptr<function, u32>, sample_index: u32, total_samples: u32) -> vec2<f32> {
  let total_samples_sqrt = sqrt(f32(total_samples));
  let x = f32(sample_index % u32(total_samples_sqrt)) / total_samples_sqrt + rngNextFloat(rng_state) / total_samples_sqrt;
  let y = f32(sample_index / u32(total_samples_sqrt)) / total_samples_sqrt + rngNextFloat(rng_state) / total_samples_sqrt;
  return vec2<f32>(x - 0.5, y - 0.5);
}

// rng functions source: https://nelari.us/post/weekend_raytracing_with_wgpu_1/
// returns a random u32 and modifies the state
fn rngNextInt(state: ptr<function, u32>) -> u32 {
  // PCG RNG
  // Based on https://www.shadertoy.com/view/XlGcRh
  let newState = *state * 747796405u + 2891336453u;
  *state = newState;
  let word = ((newState >> ((newState >> 28u) + 4u)) ^ newState) * 277803737u;
  return (word >> 22u) ^ word;
}

// returns a random float between 0 and 1 and modifies the state
fn rngNextFloat(state: ptr<function, u32>) -> f32 {
  let x = rngNextInt(state); // this modifies the state
  return f32(*state) / f32(0xffffffffu);
}

fn jenkinsHash(input: u32) -> u32 {
  var x = input;
  x += x << 10u;
  x ^= x >> 6u;
  x += x << 3u;
  x ^= x >> 11u;
  x += x << 15u;
  return x;
}

fn initRng(pixel:vec2<u32>, frame: u32, random_seed: u32) -> u32 {
  // Adapted from https://github.com/boksajak/referencePT
  let seed = dot(pixel, vec2<u32>(1u, random_seed)) ^ jenkinsHash(frame);
  return jenkinsHash(seed);
}
