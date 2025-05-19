// src/webgpu/sphere.ts
import { Material } from './material';

export class Sphere {
  private center: number[];
  private radius: number;
  private material: Material;

  constructor(center: number[], radius: number, material: Material) {
    this.center = center;
    this.radius = radius;
    this.material = material;
  }

  getSphere(): number[] {
    return [
      ...this.center,
      this.radius,
      ...this.material.getMaterial(),
    ];
  }
}
