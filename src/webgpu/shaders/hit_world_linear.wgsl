fn hit_world(ray: Ray, ray_t: Interval) -> HitRecord {
  var closest_rec = default_hit_record();
  var closest_t = ray_t.max;

  // loop through all spheres
  for (var i: u32 = 0u; i < uNumSpheres; i = i + 1u) {
    let rec = hit_sphere(spheres[i], ray, ray_t);
    if (rec.t > 0.0 && rec.t < closest_t) {
      closest_t = rec.t;
      closest_rec = rec;
    }
  }

  // loop through all quads
  for (var i: u32 = 0u; i < uNumQuads; i = i + 1u) {
    let rec = hit_quad(quads[i], ray, ray_t);
    if (rec.t > 0.0 && rec.t < closest_t) {
      closest_t = rec.t;
      closest_rec = rec;
    }
  }

  return closest_rec;
}