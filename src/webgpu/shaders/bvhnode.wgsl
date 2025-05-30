struct BVHNode {
  min: vec3<f32>, _padding1: f32,
  max: vec3<f32>, primitiveType: f32, // 0 for quad, 1 for sphere
  leftIndex: f32,
  rightIndex: f32,
  primitiveIndex: f32,
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