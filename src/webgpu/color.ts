// src/webgpu/color.ts
export class Color {
  public r: number;
  public g: number;
  public b: number;
  public a: number;

  constructor(r: number, g: number, b: number, a: number = 1.0) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }

  getColor(): number[] {
    return [this.r, this.g, this.b, this.a];
  }
  setColor(r: number, g: number, b: number, a: number = 1.0) {
    this.r = r;
    this.g = g;
    this.b = b;
    this.a = a;
  }
}
