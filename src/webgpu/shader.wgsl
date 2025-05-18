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

// Random function which returns a number between 0 and 1
fn random(st: vec2<f32>) -> f32 {
    let dot_val = dot(st, vec2<f32>(12.9898, 78.233));
    let sin_val = sin(dot_val);
    return fract(sin_val * 43758.5453123);
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

fn get_ray(pos: vec4<f32>) -> Ray {
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

  let pixel_center = pixel00_loc + (pos.x * pixel_delta_u) + (pos.y * pixel_delta_v);
  let ray_direction = pixel_center - camera_center;

  return Ray(camera_center, ray_direction);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let ray = get_ray(pos);
  let color = ray_color(ray);
  return vec4<f32>(color, 1.0);
}
