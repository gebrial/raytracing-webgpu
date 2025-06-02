import type { BoundingBox } from "../sphere";

export interface BoundingBoxList {
  readonly boundingBoxes: BoundingBox[];
  getBoundingBoxes(): BoundingBox[];
}