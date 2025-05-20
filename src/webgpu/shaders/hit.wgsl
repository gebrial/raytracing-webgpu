// Sphere intersection and hit logic for WGSL shaders

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
