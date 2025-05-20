// Camera and related math for WGSL shaders

struct Camera {
  look_from: vec3<f32>, _pad0: f32,
  look_at: vec3<f32>, _pad1: f32,
  vup: vec3<f32>, _pad2: f32,
  vfov: f32, // vertical field of view in degrees
  defocus_angle: f32, // variation angle of rays through each pixel
  focus_dist: f32, // distance from camera lookFrom point to plane of perfect focus
};

// Returns a Ray from the camera through a pixel
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
