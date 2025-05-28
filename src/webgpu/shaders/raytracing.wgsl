// Ray scattering, reflection, refraction, and color logic for WGSL shaders

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
    var hit_rec = hit_node(new_ray, Interval(0.001, INF));  // offset in interval to avoid self-intersection
    if (hit_rec.t > 0.0) {
      bounces_left = bounces_left - 1u;

      // bounce the ray
      new_ray.origin = hit_rec.p;

      let random_num = rngNextFloat(rng_state);
      if (hit_rec.material.emissive > 0.0) {
        // emissive material
        ray_color *= hit_rec.material.color.xyz * hit_rec.material.emissive;
        return ray_color;
      } else if (random_num < hit_rec.material.specular) {
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
      // return vec3<f32>(0.0); // no color
    }
  }

  return vec3<f32>(0.0); // no color
}
