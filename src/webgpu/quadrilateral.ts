import type { Material } from "./material";
import type { BoundingBox } from "./sphere";
import { Vec3 } from "./vec3";

export class Quadrilateral implements BoundingBox {
  readonly corner: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
  public material: Material;
  readonly primitiveType: number = 1;
  readonly bbPadding: number = 0.0001; // Padding for aabb bvh

  constructor(corner: Vec3, u: Vec3, v: Vec3, material: Material) {
    this.corner = corner;
    this.u = u;
    this.v = v;
    this.material = material;
  }

  getQuadrilateral(): number[] {
    return [
      ...this.corner.getVec3(), 0,
      ...this.u.getVec3(), 0,
      ...this.v.getVec3(), 0,
      ...this.material.getMaterial(),
    ];
  }

  getBoundingBoxMin(): Vec3 {
    return new Vec3(
      Math.min(this.corner.x, this.corner.x + this.u.x + this.v.x, this.corner.x + this.u.x, this.corner.x + this.v.x) - this.bbPadding / 2.0,
      Math.min(this.corner.y, this.corner.y + this.u.y + this.v.y, this.corner.y + this.u.y, this.corner.y + this.v.y) - this.bbPadding / 2.0,
      Math.min(this.corner.z, this.corner.z + this.u.z + this.v.z, this.corner.z + this.u.z, this.corner.z + this.v.z) - this.bbPadding / 2.0
    );
  }
  getBoundingBoxMax(): Vec3 {
    return new Vec3(
      Math.max(this.corner.x, this.corner.x + this.u.x + this.v.x, this.corner.x + this.u.x, this.corner.x + this.v.x) + this.bbPadding / 2.0,
      Math.max(this.corner.y, this.corner.y + this.u.y + this.v.y, this.corner.y + this.u.y, this.corner.y + this.v.y) + this.bbPadding / 2.0,
      Math.max(this.corner.z, this.corner.z + this.u.z + this.v.z, this.corner.z + this.u.z, this.corner.z + this.v.z) + this.bbPadding / 2.0
    );
  }
}
