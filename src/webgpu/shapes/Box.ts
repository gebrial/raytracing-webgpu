import type { Material } from "../material";
import { Quadrilateral } from "../quadrilateral";
import type { BoundingBox } from "../sphere";
import { Vec3 } from "../vec3";
import type { BoundingBoxList } from "./BoundingBoxList";

export class Box implements BoundingBoxList {
  readonly boundingBoxes: BoundingBox[] = [];
  readonly corner: Vec3;
  readonly u: Vec3;
  readonly v: Vec3;
  readonly w: Vec3;
  readonly material: Material;

  constructor(corner: Vec3, u: Vec3, v: Vec3, w: Vec3, material: Material) {
    this.corner = corner;
    this.u = u;
    this.v = v;
    this.w = w;
    this.material = material;

    this.boundingBoxes.push(new Quadrilateral(corner, u, v, material));
    this.boundingBoxes.push(new Quadrilateral(corner, v, w, material));
    this.boundingBoxes.push(new Quadrilateral(corner, w, u, material));
    this.boundingBoxes.push(new Quadrilateral(corner.add(u).add(v).add(w), v.negate(), u.negate(), material));
    this.boundingBoxes.push(new Quadrilateral(corner.add(u).add(v).add(w), w.negate(), v.negate(), material));
    this.boundingBoxes.push(new Quadrilateral(corner.add(u).add(v).add(w), u.negate(), w.negate(), material));
  }

  static fromMinMax(minCorner: Vec3, maxCorner: Vec3, material: Material): Box {
    const u = new Vec3(maxCorner.x - minCorner.x, 0, 0);
    const v = new Vec3(0, maxCorner.y - minCorner.y, 0);
    const w = new Vec3(0, 0, maxCorner.z - minCorner.z);
    return new Box(minCorner, u, v, w, material);
  }

  getBoxCenter(): Vec3 {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const quad of this.boundingBoxes as Quadrilateral[]) {
      const min = quad.getBoundingBoxMin();
      const max = quad.getBoundingBoxMax();
      minX = Math.min(minX, min.x);
      minY = Math.min(minY, min.y);
      minZ = Math.min(minZ, min.z);
      maxX = Math.max(maxX, max.x);
      maxY = Math.max(maxY, max.y);
      maxZ = Math.max(maxZ, max.z);
    }
    return new Vec3((minX + maxX) / 2, (minY + maxY) / 2, (minZ + maxZ) / 2);
  }

  rotate(angle: number, axis: Vec3): Box {
    // rotate the box around the center by the given angle around the given axis
    const center = this.getBoxCenter();
    const rotatedCorner = this.corner.subtract(center).rotate(angle, axis).add(center);
    const rotatedU = this.u.rotate(angle, axis);
    const rotatedV = this.v.rotate(angle, axis);
    const rotatedW = this.w.rotate(angle, axis);
    return new Box(rotatedCorner, rotatedU, rotatedV, rotatedW, this.material);
  }

  getBoundingBoxes(): BoundingBox[] {
    return this.boundingBoxes;
  }
}
