// src/webgpu/sphere.ts
import { Material } from './material';
import type { Vec3 } from './vec3';

export class Sphere {
  private center: Vec3;
  private radius: number;
  private material: Material;

  constructor(center: Vec3, radius: number, material: Material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }

  getSphere(): number[] {
    return [
      ...this.center.getVec3(),
      this.radius,
      ...this.material.getMaterial(),
    ];
  }
}
