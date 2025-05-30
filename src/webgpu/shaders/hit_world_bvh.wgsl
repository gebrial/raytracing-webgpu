
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
