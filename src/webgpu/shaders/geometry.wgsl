// Material, Ray, Sphere, and HitRecord definitions for WGSL shaders

struct Material {
  color: vec4<f32>,
  diffuse: f32,
  specular: f32,
  // refraction chance = 1 - diffuse - specular
  fuzz: f32,
  refractionIndex: f32,
  emissive: f32,
  _padding1: f32,
  _padding2: f32,
  _padding3: f32,
};

struct Ray {
  origin: vec3<f32>,
  direction: vec3<f32>,
}

struct HitRecord {
  t: f32, // hit time?
  p: vec3<f32>, // hit point
  normal: vec3<f32>, // surface normal at hit point
  material: Material, // material at hit point
};

struct Sphere {
  center: vec3<f32>,
  radius: f32,
  material: Material,
};

fn default_material() -> Material {
  return Material(vec4<f32>(1.0), 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0);
}

fn default_hit_record() -> HitRecord {
  return HitRecord(-1.0, vec3<f32>(0.0), vec3<f32>(0.0), default_material());
}
