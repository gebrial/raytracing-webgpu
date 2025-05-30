// Helper: AABB-ray intersection
fn aabb_hit(bbmin: vec3<f32>, bbmax: vec3<f32>, ray: Ray, ray_t: Interval) -> bool {
  var tmin = ray_t.min;
  var tmax = ray_t.max;
  for (var a = 0; a < 3; a = a + 1) {
    let invD = 1.0 / ray.direction[a];
    var t0 = (bbmin[a] - ray.origin[a]) * invD;
    var t1 = (bbmax[a] - ray.origin[a]) * invD;
    if (invD < 0.0) {
      let tmp = t0;
      t0 = t1;
      t1 = tmp;
    }
    tmin = max(tmin, t0);
    tmax = min(tmax, t1);
    if (tmax < tmin) {
      return false;
    }
  }
  return true;
}

// function to check which primitive type (quad vs sphere) is contained in the BVH node
fn is_quad(n: BVHNode) -> bool {
  return n.primitiveType == 1.0;
}

fn is_sphere(n: BVHNode) -> bool {
  return n.primitiveType == 0.0;
}

// Hit record for intersection tests
// normal should be a unit vector facing "outwards" from the surface
fn hit_world(ray: Ray, ray_t: Interval) -> HitRecord {
  // Stack-based traversal (max 32 nodes, adjust as needed)
  var stack: array<u32, 32>;
  var stackPtr: u32 = 0u;
  var closest_rec = default_hit_record();
  var closest_t = ray_t.max;

  // Start with root node (assume node is root, index 0)
  stack[stackPtr] = 0u;
  stackPtr = stackPtr + 1u;

  loop {
    if (stackPtr == 0u) { break; }
    stackPtr = stackPtr - 1u;
    let nodeIdx = stack[stackPtr];
    let n = bvhNodes[nodeIdx];

    // AABB test
    if (!aabb_hit(n.min, n.max, ray, Interval(ray_t.min, closest_t))) {
      continue;
    }

    if (n.isLeaf > 0.5) {
      // Leaf: test sphere
      let primitiveIndex = u32(n.primitiveIndex);
      if (is_sphere(n)) {
        // sphere
        let rec = hit_sphere(spheres[primitiveIndex], ray, Interval(ray_t.min, closest_t));
        if (rec.t > 0.0 && rec.t < closest_t) {
          closest_t = rec.t;
          closest_rec = rec;
        }
      } else {
        // quad
        let rec = hit_quad(quads[primitiveIndex], ray, Interval(ray_t.min, closest_t));
        if (rec.t > 0.0 && rec.t < closest_t) {
          closest_t = rec.t;
          closest_rec = rec;
        }
      }
    } else {
      // Push children (right, then left)
      stack[stackPtr] = u32(n.rightIndex);
      stackPtr = stackPtr + 1u;
      stack[stackPtr] = u32(n.leftIndex);
      stackPtr = stackPtr + 1u;
    }
  }

  return closest_rec;
}
