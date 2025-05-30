fn ray_miss(ray: Ray) -> vec3<f32> {
  // Background color for blue sky
  let unit_direction = normalize(ray.direction);
  let a = 0.5 * (unit_direction.y + 1.0);
  return mix(vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.5, 0.7, 1.0), a);
}
