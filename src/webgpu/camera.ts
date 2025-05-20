import type { Vec3 } from "./vec3";

export class Camera {
  lookFrom: Vec3;
  lookAt: Vec3;
  vup: Vec3;
  vfov: number = 20.0 * (Math.PI / 180.0); // vertical field of view in radians
  defocus_angle = 10.0 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
  focus_dist = 3.4; // distance from camera lookFrom point to plane of perfect focus

  constructor(lookFrom: Vec3, lookAt: Vec3, vup: Vec3) {
    this.lookFrom = lookFrom;
    this.lookAt = lookAt;
    this.vup = vup;
  }

  getCamera(): number[] {
    return [
      ...this.lookFrom.getVec3(), 0, // pad to 4 floats
      ...this.lookAt.getVec3(), 0,  // pad to 4 floats
      ...this.vup.getVec3(), 0,       // pad to 4 floats
      this.vfov, this.defocus_angle, this.focus_dist, 0,  // pad to 4 floats
    ];
  }
}