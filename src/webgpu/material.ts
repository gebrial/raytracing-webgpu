// src/webgpu/material.ts
import { Color } from './color';

export class Material {
  protected color: Color;
  protected diffuse: number;
  protected specular: number;
  protected fuzz: number = 0.0;
  protected refractionIndex: number = 1.0;

  constructor(color: Color, diffuse: number, specular: number, fuzz: number = 0.0, refractionIndex: number = 1.0) {
    this.color = color;
    this.diffuse = diffuse;
    this.specular = specular;
    this.fuzz = fuzz;
    this.refractionIndex = refractionIndex;
  }

  getMaterial(): number[] {
    return [
      ...this.color.getColor(),
      this.diffuse,
      this.specular,
      this.fuzz,
      this.refractionIndex,
    ];
  }
}

export class LambertianMaterial extends Material {
  constructor(color: Color) {
    const diffuse = 1.0;
    super(color, diffuse, 1.0 - diffuse);
  }
}

export class MetalMaterial extends Material {
  constructor(color: Color, fuzz: number) {
    const diffuse = 0.0;
    super(color, diffuse, 1.0 - diffuse, fuzz);
  }
}

export class DielectricMaterial extends Material {
  constructor(refractionIndex: number) {
    super(new Color(1.0, 1.0, 1.0), 0.0, 0.0, 0.0, refractionIndex);
  }
}
