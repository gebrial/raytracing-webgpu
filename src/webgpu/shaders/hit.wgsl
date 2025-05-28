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

fn hit_quad(quad: Quad, ray: Ray, ray_t: Interval) -> HitRecord {
  // Implement quad intersection logic here
  var temp_rec = default_hit_record();
  
  // we should cache these values in the quad struct
  let n = cross(quad.u, quad.v);
  let normal = normalize(n);
  let D = dot(normal, quad.corner);

  let denom = dot(normal, ray.direction);
  if (abs(denom) < 1e-6) {
    return temp_rec; // Ray is parallel to the plane
  }

  let t = (D - dot(normal, ray.origin)) / denom;
  if (t < ray_t.min || t > ray_t.max) {
    return temp_rec; // Intersection is outside the ray's travel interval
  }

  let intersection = ray.origin + t * ray.direction;

  temp_rec.t = t;
  temp_rec.p = intersection;
  temp_rec.front_face = is_front_face(ray, normal);
  temp_rec.normal = get_face_normal(ray, normal);
  temp_rec.material = quad.material;

  return temp_rec;
}

fn is_front_face(ray: Ray, outward_normal: vec3<f32>) -> bool {
  // Check if the ray is hitting the front face of the surface
  return dot(ray.direction, outward_normal) < 0.0;
}

// Returns the normal at the hit point, facing the ray direction
fn get_face_normal(ray: Ray, outward_normal: vec3<f32>) -> vec3<f32> {
  // Set the normal to face the ray direction
  let front_face = is_front_face(ray, outward_normal);
  if (front_face) {
    return outward_normal; // outward facing
  } else {
    return -outward_normal; // inward facing
  }
}