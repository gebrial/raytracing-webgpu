// src/webgpu/sphere.ts
import { Material } from './material';
import { Vec3 } from './vec3';

export interface BoundingBox {
  getBoundingBoxMin(): Vec3;
  getBoundingBoxMax(): Vec3;
  primitiveType: number;
}

export class Sphere implements BoundingBox {
  public center: Vec3;
  public radius: number;
  public material: Material;
  readonly primitiveType: number = 0;

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

  getBoundingBoxMin(): Vec3 {
    return new Vec3(
      this.center.x - this.radius,
      this.center.y - this.radius,
      this.center.z - this.radius
    );
  }

  getBoundingBoxMax(): Vec3 {
    return new Vec3(
      this.center.x + this.radius,
      this.center.y + this.radius,
      this.center.z + this.radius
    );
  }
}
