// src/webgpu/shader.wgsl
// Fullscreen triangle gradient shader

const RAY_TMAX: f32 = 100000.0;
const PI: f32 = 3.141592653589793;
const INF: f32 = 3.402823466e+38; // Maximum finite f32 value

struct CanvasSize {
  size: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uCanvas: CanvasSize;

// todo use forward and up vectors in viewport
// define camera position
struct Camera {
  position: vec3<f32>,
  forward: vec3<f32>,
  up: vec3<f32>,
};
@group(0) @binding(1) var<uniform> uCamera: Camera;

struct FrameTime {
  frame: f32,
  time: f32,
};
@group(0) @binding(2) var<uniform> uFrameTime: FrameTime;

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
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

fn initRng(pixel:vec2<u32>, resolution: vec2<u32>, frame: u32) -> u32 {
  // Adapted from https://github.com/boksajak/referencePT
  let seed = dot(pixel, vec2<u32>(1u, resolution.x)) ^ jenkinsHash(frame);
  return jenkinsHash(seed);
}

fn degrees_to_radians(degrees: f32) -> f32 {
  return degrees * (PI / 180.0);
}




// Interval struct and functions
struct Interval {
  min: f32,
  max: f32,
};

fn interval_universe() -> Interval {
  return Interval(-INF, INF);
}

fn interval_empty() -> Interval {
  return Interval(INF, -INF);
}

fn interval_ahead() -> Interval {
  return Interval(0.0, RAY_TMAX);
}

fn interval(min: f32, max: f32) -> Interval {
  return Interval(min, max);
}


fn interval_size(interval: Interval) -> f32 {
  return interval.max - interval.min;
}
// returns true if the value is within the interval, boundaries included
fn interval_contains(interval: Interval, value: f32) -> bool {
  return (value >= interval.min && value <= interval.max);
}
// returns true if the value is inside the interval, boundaries excluded
fn interval_surrounds(interval: Interval, value: f32) -> bool {
  return (value > interval.min && value < interval.max);
}




struct Ray {
  origin: vec3<f32>,
  direction: vec3<f32>,
}

struct HitRecord {
  t: f32, // hit time?
  p: vec3<f32>, // hit point
  normal: vec3<f32>, // surface normal at hit point
};

fn default_hit_record() -> HitRecord {
  return HitRecord(-1.0, vec3<f32>(0.0), vec3<f32>(0.0));
}

struct Sphere {
  center: vec3<f32>,
  radius: f32,
};

// Storage buffer for spheres
@group(0) @binding(3) var<storage, read> spheres: array<Sphere>;
@group(0) @binding(4) var<uniform> uNumSpheres: u32;

fn hit_sphere(sphere: Sphere, ray: Ray, ray_t: Interval) -> HitRecord {
  let oc = sphere.center - ray.origin;
  let a = dot(ray.direction, ray.direction);
  let h = dot(oc, ray.direction);
  let c = dot(oc, oc) - sphere.radius * sphere.radius;
  let discriminant = h * h - a * c;
  if (discriminant < 0.0) {
    return default_hit_record();
  }

  let sqrtd = sqrt(discriminant);

  // Find the nearest root in the range [ray_tmin, ray_tmax]
  var root = (h - sqrtd) / a;
  if (root <= ray_t.min || ray_t.max <= root) {
    root = (h + sqrtd) / a;
    if (root <= ray_t.min || ray_t.max <= root) {
      return default_hit_record();
    }
  }

  var rec = default_hit_record();
  rec.t = root;
  rec.p = ray.origin + root * ray.direction;
  rec.normal = (rec.p - sphere.center) / sphere.radius; // length 1 vector facing outwards
  return rec;
}

// Returns the closest hit among all spheres
fn hit_spheres(ray: Ray, ray_t: Interval) -> HitRecord {
  var travel_interval = interval(ray_t.min, ray_t.max);
  var temp_rec = default_hit_record();
  for (var i: u32 = 0u; i < uNumSpheres; i = i + 1u) {
    let rec = hit_sphere(spheres[i], ray, travel_interval);
    if (rec.t > 0.0 && rec.t < travel_interval.max) {
      travel_interval.max = rec.t;
      temp_rec = rec;
    }
  }
  
  return temp_rec;
}

fn ray_color(ray: Ray) -> vec3<f32> {
  let rec = hit_spheres(ray, interval_ahead());
  if (rec.t > 0.0) {
    let N = rec.normal;
    return 0.5 * vec3<f32>(N.x + 1.0, N.y + 1.0, N.z + 1.0); // Color based on normal
  }

  // Placeholder for ray tracing logic
  // For now, just return a color based on the ray direction
  let unit_direction = normalize(ray.direction);
  let a = 0.5 * (unit_direction.y + 1.0);
  return mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.5, 0.7, 1.0), a);
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

fn get_ray(pos: vec4<f32>, rng_state: ptr<function, u32>, sample_index: u32, total_samples: u32) -> Ray {
  let aspect_ratio = uCanvas.size.x / uCanvas.size.y;
  let uv = pos.xy / uCanvas.size;

  // camera
  let focal_length = 1.0;
  let viewport_height = 2.0;
  let viewport_width = viewport_height * aspect_ratio;
  let camera_center = uCamera.position;

  // viewport horizontal/vertical vectors
  let viewport_u = vec3<f32>(viewport_width, 0.0, 0.0);
  let viewport_v = vec3<f32>(0.0, -viewport_height, 0.0);

  // horizontal/vertical delta vectors between pixels, vec3
  let pixel_delta_u = viewport_u / uCanvas.size.x;
  let pixel_delta_v = viewport_v / uCanvas.size.y;

  // location of upper left pixel
  let viewport_upper_left = camera_center - vec3<f32>(0, 0, focal_length) - (viewport_u / 2.0) - (viewport_v / 2.0);
  let pixel00_loc = viewport_upper_left + 0.5 * pixel_delta_u + 0.5 * pixel_delta_v;

  let jiggle = sample_square_stratified(rng_state, sample_index, total_samples);
  let pixel_center = pixel00_loc + ((pos.x + jiggle.x) * pixel_delta_u) + ((pos.y + jiggle.y) * pixel_delta_v);
  let ray_direction = pixel_center - camera_center;

  return Ray(camera_center, ray_direction);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let pixel = vec2<u32>(u32(pos.x), u32(pos.y));
  let resolution = vec2<u32>(u32(uCanvas.size.x), u32(uCanvas.size.y));
  let frame = u32(uFrameTime.frame);
  var rng_state: u32 = initRng(pixel, resolution, frame);

  // average over multiple samples
  let samples_sqrt = 10u;
  let samples = samples_sqrt * samples_sqrt;
  var color = vec3<f32>(0.0);
  for (var i: u32 = 0u; i < samples; i = i + 1u) {
    let ray = get_ray(pos, &rng_state, i, samples);
    var tmp_color = ray_color(ray);
    tmp_color.x = clamp(tmp_color.x, 0.0, 1.0);
    tmp_color.y = clamp(tmp_color.y, 0.0, 1.0);
    tmp_color.z = clamp(tmp_color.z, 0.0, 1.0);
    color += tmp_color;
  }
  color /= f32(samples);
  color = sqrt(color); // gamma correction
  return vec4<f32>(color, 1.0);
}
