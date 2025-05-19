export class Camera {
  position: number[];
  forward: number[];
  up: number[];
  vfov: number = Math.PI / 2.0; // vertical field of view in radians
  constructor(position: number[], forward: number[], up: number[]) {
    this.position = position;
    this.forward = forward;
    this.up = up;
  }

  getCamera(): number[] {
    return [
      ...this.position, 0, // pad to 4 floats
      ...this.forward, 0,  // pad to 4 floats
      ...this.up, 0,       // pad to 4 floats
      this.vfov, 0, 0, 0,  // pad to 4 floats
    ];
  }
}