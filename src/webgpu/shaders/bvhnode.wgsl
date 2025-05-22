struct BVHNode {
  min: vec3<f32>, _padding1: f32,
  max: vec3<f32>, _padding2: f32,
  leftIndex: f32,
  rightIndex: f32,
  sphereIndex: f32,
  isLeaf: f32,
};

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
    if (tmax <= tmin) {
      return false;
    }
  }
  return true;
}

fn hit_node(ray: Ray, ray_t: Interval) -> HitRecord {
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
      let sphereIdx = u32(n.sphereIndex);
      let rec = hit_sphere(spheres[sphereIdx], ray, Interval(ray_t.min, closest_t));
      if (rec.t > 0.0 && rec.t < closest_t) {
        closest_t = rec.t;
        closest_rec = rec;
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
