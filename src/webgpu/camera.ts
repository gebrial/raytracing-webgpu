export class Camera {
  lookFrom: number[];
  lookAt: number[];
  vup: number[];
  vfov: number = 20.0 * (Math.PI / 180.0); // vertical field of view in radians
  constructor(lookFrom: number[], lookAt: number[], vup: number[]) {
    if (lookFrom.length !== 3 || lookAt.length !== 3 || vup.length !== 3) {
      throw new Error('lookFrom, lookAt, and vup must be arrays of length 3');
    }
    this.lookFrom = lookFrom;
    this.lookAt = lookAt;
    this.vup = vup;
  }

  getCamera(): number[] {
    return [
      ...this.lookFrom, 0, // pad to 4 floats
      ...this.lookAt, 0,  // pad to 4 floats
      ...this.vup, 0,       // pad to 4 floats
      this.vfov, 0, 0, 0,  // pad to 4 floats
    ];
  }
}