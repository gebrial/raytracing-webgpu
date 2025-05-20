// src/webgpu/shader.wgsl
// Fullscreen triangle gradient shader

const RAY_TMAX: f32 = 100000.0;
const INF: f32 = 3.402823466e+38; // Maximum finite f32 value

struct CanvasSize {
  size: vec2<f32>,
};
@group(0) @binding(0) var<uniform> uCanvas: CanvasSize;

// todo use forward and up vectors in viewport
// define camera position
struct Camera {
  look_from: vec3<f32>, _pad0: f32,
  look_at: vec3<f32>, _pad1: f32,
  vup: vec3<f32>, _pad2: f32,
  vfov: f32, // vertical field of view in degrees
  defocus_angle: f32, // variation angle of rays through each pixel
  focus_dist: f32, // distance from camera lookFrom point to plane of perfect focus
};
@group(0) @binding(1) var<uniform> uCamera: Camera;

struct FrameTime {
  frame: f32,
  time: f32,
};
@group(0) @binding(2) var<uniform> uFrameTime: FrameTime;

struct RenderSettings {
  num_samples_sqrt: u32,
  num_bounces: u32,
};
@group(0) @binding(5) var<uniform> uRenderSettings: RenderSettings;

@group(0) @binding(6) var previousFrame: texture_2d<f32>;
@group(0) @binding(7) var previousFrameSampler: sampler;

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


struct Material {
  color: vec4<f32>,
  diffuse: f32,
  specular: f32,
  // refraction chance = 1 - diffuse - specular
  fuzz: f32,
  refractionIndex: f32,
};


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
  material: Material, // material at hit point
};

fn default_hit_record() -> HitRecord {
  return HitRecord(-1.0, vec3<f32>(0.0), vec3<f32>(0.0), Material(vec4<f32>(1.0), 0.0, 1.0, 0.0, 1.0));
}

struct Sphere {
  center: vec3<f32>,
  radius: f32,
  material: Material,
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
  rec.material = sphere.material;
  return rec;
}

// Returns the closest hit among all spheres
fn hit_spheres(ray: Ray, ray_t: Interval) -> HitRecord {
  var travel_interval = Interval(ray_t.min, ray_t.max);
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

fn reflect_ray(ray: Ray, normal: vec3<f32>) -> vec3<f32> {
  return ray.direction - 2.0 * dot(ray.direction, normal) * normal;
}

fn scatter_ray(normal: vec3<f32>, rng_state: ptr<function, u32>) -> vec3<f32> {
  // Lambertian scatter
  var scatter_direction = normal + random_unit_vector(rng_state);
  // Catch degenerate scatter direction
  if (length(scatter_direction) < 0.001) {
    scatter_direction = normal;
  }
  return normalize(scatter_direction);
}

// refractive_index_ratio is eta / eta'
// eta' is the refractive index of the medium the ray is entering
// eta is the refractive index of the medium the ray is leaving
fn refract_ray(ray: Ray, normal: vec3<f32>, refractive_index_ratio: f32) -> vec3<f32> {
  let cos_theta = min(dot(-ray.direction, normal), 1.0);
  let r_out_perp = refractive_index_ratio * (ray.direction + cos_theta * normal);
  let r_out_parallel = -sqrt(abs(1.0 - dot(r_out_perp, r_out_perp))) * normal;
  return r_out_perp + r_out_parallel;
}

fn reflectance(cosine: f32, refractive_index_ratio: f32) -> f32 {
  // Schlick's approximation for reflectance
  // https://www.desmos.com/calculator/9stibbnjmk
  var r0 = (1.0 - refractive_index_ratio) / (1.0 + refractive_index_ratio);
  r0 = r0 * r0;
  return r0 + (1.0 - r0) * pow(1.0 - cosine, 5.0);
}

fn ray_color(ray: Ray, rng_state: ptr<function, u32>) -> vec3<f32> {
  var bounces_left = uRenderSettings.num_bounces;
  var new_ray = Ray(ray.origin, ray.direction);
  var ray_color = vec3<f32>(1.0);
  while (bounces_left > 0u) {
    new_ray.direction = normalize(new_ray.direction);
    var hit_rec = hit_spheres(new_ray, Interval(0.001, INF));  // offset in interval to avoid self-intersection
    if (hit_rec.t > 0.0) {
      bounces_left = bounces_left - 1u;

      // bounce the ray
      new_ray.origin = hit_rec.p;

      let random_num = rngNextFloat(rng_state);
      if (random_num < hit_rec.material.specular) {
        // specular reflection
        new_ray.direction = normalize(reflect_ray(new_ray, hit_rec.normal));
        new_ray.direction += hit_rec.material.fuzz * random_unit_vector(rng_state);
        if (dot(new_ray.direction, hit_rec.normal) <= 0.0) {
          return vec3<f32>(0.0); // ray is inside the sphere, return black
        }
      } else if (random_num > 1.0 - hit_rec.material.diffuse) {
        // diffuse reflection
        new_ray.direction = scatter_ray(hit_rec.normal, rng_state);
      } else {
        // refraction
        var refractive_index_ratio = 1.0 / hit_rec.material.refractionIndex;
        if (dot(new_ray.direction, hit_rec.normal) > 0.0) {
          // ray is inside the sphere, use the inverse of the refractive index
          refractive_index_ratio = 1.0 / refractive_index_ratio;
          hit_rec.normal = -hit_rec.normal; // flip the normal
        }

        let cos_theta = min(dot(-new_ray.direction, hit_rec.normal), 1.0);
        let sin_theta = sqrt(1.0 - cos_theta * cos_theta);
        let cannot_refract = refractive_index_ratio * sin_theta > 1.0;
        let random_num2 = rngNextFloat(rng_state);
        if (cannot_refract || reflectance(cos_theta, refractive_index_ratio) > random_num2) {
          // total internal reflection
          new_ray.direction = reflect_ray(new_ray, hit_rec.normal);
        } else {
          // refract the ray
          new_ray.direction = refract_ray(new_ray, hit_rec.normal, refractive_index_ratio);
        }
      }

      ray_color *= hit_rec.material.color.xyz;
    } else {
      // For now, just return a color based on the ray direction
      let unit_direction = normalize(new_ray.direction);
      let a = 0.5 * (unit_direction.y + 1.0);
      ray_color *= mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.5, 0.7, 1.0), a);
      return ray_color;
    }
  }

  return vec3<f32>(0.0); // no color
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
  let camera_center = uCamera.look_from;

  // viewport dimensions
  let focus_dist = uCamera.focus_dist;
  let h = tan(uCamera.vfov / 2.0);
  let viewport_height = 2.0 * h * focus_dist;
  let viewport_width = viewport_height * aspect_ratio;

  // u, v, w unit basis vectors for camera coordinate frame
  let w = normalize(uCamera.look_from - uCamera.look_at);
  let u = normalize(cross(uCamera.vup, w));
  let v = cross(w, u);

  // viewport horizontal/vertical vectors
  let viewport_u = viewport_width * u;
  let viewport_v = viewport_height * -v;

  // horizontal/vertical delta vectors between pixels, vec3
  let pixel_delta_u = viewport_u / uCanvas.size.x;
  let pixel_delta_v = viewport_v / uCanvas.size.y;

  // location of upper left pixel
  let viewport_upper_left = camera_center - (focus_dist * w) - (viewport_u / 2.0) - (viewport_v / 2.0);
  let pixel00_loc = viewport_upper_left + 0.5 * pixel_delta_u + 0.5 * pixel_delta_v;

  // camera defocus disk basis vectors
  let defocus_radius = focus_dist * tan(uCamera.defocus_angle / 2.0);
  let defocus_disk_u = defocus_radius * u;
  let defocus_disk_v = defocus_radius * v;

  let jiggle = sample_square_stratified(rng_state, sample_index, total_samples);
  let pixel_sample = pixel00_loc + ((pos.x + jiggle.x) * pixel_delta_u) + ((pos.y + jiggle.y) * pixel_delta_v);

  let p = random_in_unit_disk(rng_state);
  let ray_origin = camera_center + defocus_disk_u * p.x + defocus_disk_v * p.y;

  let ray_direction = pixel_sample - ray_origin;

  return Ray(ray_origin, ray_direction);
}

@fragment
fn fs_main(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let pixel = vec2<u32>(u32(pos.x), u32(pos.y));
  let resolution = vec2<u32>(u32(uCanvas.size.x), u32(uCanvas.size.y));
  let frame = u32(uFrameTime.frame);
  var rng_state: u32 = initRng(pixel, resolution, frame);

  // average over multiple samples
  let samples_sqrt = uRenderSettings.num_samples_sqrt;
  let samples = samples_sqrt * samples_sqrt;
  var color = vec3<f32>(0.0);
  for (var i: u32 = 0u; i < samples; i = i + 1u) {
    let ray = get_ray(pos, &rng_state, i, samples);
    color += ray_color(ray, &rng_state);
  }
  color /= f32(samples);
  color = sqrt(color); // gamma correction
  color = clamp(color, vec3(0.0), vec3(1.0));

  // Sample previous frame
  let uv = pos.xy / uCanvas.size;
  let prevColor = textureSample(previousFrame, previousFrameSampler, uv).xyz;
  // Blend: accumulate new color with previous
  let outColor = mix(prevColor, color, 1.0 / f32(frame + 1));
  return vec4<f32>(outColor, 1.0);
}
