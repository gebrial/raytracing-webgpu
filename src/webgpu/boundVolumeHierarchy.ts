import type { BoundingBox } from "./sphere";
import { Vec3 } from "./vec3";

export class BVHNode {
  private min: Vec3;
  private max: Vec3;
  private left: BVHNode | null = null;
  private right: BVHNode | null = null;
  private primitiveIndex: number = -1;
  private primitiveType: number = -1;
  private isLeaf: boolean;
  public thisIndex: number = 0;

  constructor(primitives: {index: number, object: BoundingBox}[]) {
    function getLongestAxis(min: Vec3, max: Vec3): number {
      const xSpan = max.x - min.x;
      const ySpan = max.y - min.y;
      const zSpan = max.z - min.z;
      if (xSpan >= ySpan && xSpan >= zSpan) {
        return 0; // x-axis
      } else if (ySpan >= xSpan && ySpan >= zSpan) {
        return 1; // y-axis
      } else {
        return 2; // z-axis
      }
    }

    function getBoundingBox(primitives: BoundingBox[]): { min: Vec3; max: Vec3 } {
      let min = new Vec3(Infinity, Infinity, Infinity);
      let max = new Vec3(-Infinity, -Infinity, -Infinity);
      for (let i = 0; i < primitives.length; i++) {
        const primitive = primitives[i];
        const sphereMin = primitive.getBoundingBoxMin();
        const sphereMax = primitive.getBoundingBoxMax();
        min = Vec3.min(min, sphereMin);
        max = Vec3.max(max, sphereMax);
      }
      return { min, max };
    }

    const { min, max } = getBoundingBox(primitives.map(s => s.object));
    let axis = getLongestAxis(min, max);

    const objectSpan = primitives.length;
    if (objectSpan === 1) {
      this.primitiveIndex = primitives[0].index;
      this.primitiveType = primitives[0].object.primitiveType;
      this.isLeaf = true;
      this.min = primitives[0].object.getBoundingBoxMin();
      this.max = primitives[0].object.getBoundingBoxMax();
    } else if (objectSpan === 2) {
      this.left = new BVHNode([primitives[0]]);
      this.right = new BVHNode([primitives[1]]);
      this.isLeaf = false;
      this.min = Vec3.min(this.left.min, this.right.min);
      this.max = Vec3.max(this.left.max, this.right.max);
    } else {
      // sort spheres along the chosen axis
      // based on min value of the bounding box
      primitives.sort((a, b) => {
        const aMin = a.object.getBoundingBoxMin().at(axis);
        const bMin = b.object.getBoundingBoxMin().at(axis);
        return aMin - bMin;
      });

      const mid = Math.floor(objectSpan / 2);
      this.left = new BVHNode(primitives.slice(0, mid));
      this.right = new BVHNode(primitives.slice(mid, objectSpan));
      this.isLeaf = false;
      this.min = Vec3.min(this.left.min, this.right.min);
      this.max = Vec3.max(this.left.max, this.right.max);
    }
  }

  getLeftChild(): BVHNode | null {
    return this.left;
  }
  getRightChild(): BVHNode | null {
    return this.right;
  }

  getNodeData(): number[] {
    const nodeData = [
      ...this.min.getVec3(), 0, // padding to 4 floats
      ...this.max.getVec3(), this.primitiveType, // padding to 4 floats
      this.left?.thisIndex || 0, this.right?.thisIndex || 0,
      this.primitiveIndex,
      this.isLeaf ? 1 : 0,
    ];
    return nodeData;
  }

  static collectNodes(node: BVHNode): BVHNode[] {
    const nodes: BVHNode[] = [];
    nodes.push(node);
    if (node.left) {
      nodes.push(...BVHNode.collectNodes(node.left));
    }
    if (node.right) {
      nodes.push(...BVHNode.collectNodes(node.right));
    }
    return nodes;
  }

  static getAllNodesData(node: BVHNode): number[] {
    const nodes: BVHNode[] = BVHNode.collectNodes(node);

    nodes.forEach((n, index) => {
      n.thisIndex = index;
    });

    const nodeData: number[] = [];
    nodes.forEach(n => {
      nodeData.push(...n.getNodeData());
    });
    return nodeData;
  }
}
