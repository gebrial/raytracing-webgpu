import { Camera } from "./camera";
import { Color } from "./color";
import { DielectricMaterial, EmissiveMaterial, GlossyMaterial, LambertianMaterial, MetalMaterial } from "./material";
import { Quadrilateral } from "./quadrilateral";
import { Box } from "./shapes/Box";
import { Sphere, type BoundingBox } from "./sphere";
import { Vec3 } from "./vec3";

export abstract class Scene {
  abstract getObjectsArray(): BoundingBox[];
  abstract getCameraData(time?: number): Float32Array;
}

export class BasicScene extends Scene {
  getObjectsArray(): BoundingBox[] {
    const objects: BoundingBox[] = [];

    const materialGround = new LambertianMaterial(new Color(0.8, 0.8, 0.0));
    const materialCenter = new LambertianMaterial(new Color(0.1, 0.2, 0.5));
    const materialLeft = new DielectricMaterial(1.5);
    const materialBubble = new DielectricMaterial(1.0 / 1.5);
    const materialRight = new MetalMaterial(new Color(0.8, 0.6, 0.2), 0.0);

    objects.push(
      new Sphere(new Vec3(0, -100.5, -1.0), 100.0, materialGround),
      new Sphere(new Vec3(0, 0, -1.2), 0.5, materialCenter),
      new Sphere(new Vec3(-1.0, 0, -1.0), 0.5, materialLeft),
      new Sphere(new Vec3(-1.0, 0, -1.0), 0.4, materialBubble),
      new Sphere(new Vec3(1.0, 0, -1.0), 0.5, materialRight)
    );

    return objects;
  }

  getCameraData(_time: number = 0): Float32Array {
    // Basic scene camera configuration
    const lookFrom = new Vec3(0, 0, 0); // camera position
    const lookAt = new Vec3(0, 0, -1); // point to look at
    const vup = new Vec3(0, 1, 0); // up vector
    const camera = new Camera(lookFrom, lookAt, vup);
    camera.vfov = 90.0 * (Math.PI / 180.0); // vertical field of view in radians
    camera.defocus_angle = 0.0 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
    camera.focus_dist = lookFrom.distanceTo(lookAt); // distance from camera lookFrom point to plane of perfect focus
    return new Float32Array(camera.getCamera());
  }
}

export class FinalScene extends Scene {
  getObjectsArray(): BoundingBox[] {
    const objects: BoundingBox[] = [];

    const groundMaterial = new LambertianMaterial(new Color(0.5, 0.5, 0.5));
    const groundQuad = new Quadrilateral(
      new Vec3(-100, 0, -100), // corner
      new Vec3(200, 0, 0), // u vector
      new Vec3(0, 0, 200), // v vector
      groundMaterial
    );
    objects.push(groundQuad);

    const sunMaterial = new EmissiveMaterial(new Color(1, 1, 1), 5);
    const sunYAngle = 41.8 * (Math.PI / 180.0); // angle so that parallel rays cause glass spheres to focus light on ground
    const sunDistance = 2000;
    const sunHeight = Math.tan(sunYAngle) * sunDistance;
    const sunXZAngle = 1;
    var sunRadius =  sunDistance * 695700.0 / 149600000.0; // real sun apparent size
    sunRadius *= 30; // scale up the sun radius to be visible in the scene
    const sunPosition = new Vec3(sunDistance * Math.cos(sunXZAngle), sunHeight, -sunDistance * Math.sin(sunXZAngle));
    const sunSphere = new Sphere(sunPosition, sunRadius, sunMaterial);

    for (let i = -11; i < 11; i++) {
      for (let j = -11; j < 11; j++) {
        const materialType = Math.random();
        const center = new Vec3(i + 0.9 * Math.random(), 0.2, j + 0.9 * Math.random());
        const nearMetalBall = new Vec3(4, 0.2, 0);
        const distance = center.distanceTo(nearMetalBall);
        if (distance < 0.9) {
          continue; // Skip this sphere if it's too close to the metal ball
        }
        let material: any;

        if (materialType < 0.2) {
          // emissive
          const albedo = new Color(Math.random(), Math.random(), Math.random());
          material = new EmissiveMaterial(albedo, Math.random() * 2.0);
        } else if (materialType < 0.4) {
          // glossy
          const fuzz = Math.random() * 0.5;
          const albedo = new Color(Math.random() * Math.random(), Math.random() * Math.random(), Math.random() * Math.random());
          material = new GlossyMaterial(albedo, fuzz, Math.random() * 0.5 + 0.25);
        } else if (materialType < 0.8) {
          // diffuse
          material = new LambertianMaterial(new Color(Math.random() * Math.random(), Math.random() * Math.random(), Math.random() * Math.random()));
        } else if (materialType < 0.95) {
          // metal
          const albedo = new Color(Math.random()*0.5 + 0.5, Math.random()*0.5 + 0.5, Math.random()*0.5 + 0.5);
          const fuzz = Math.random() * 0.5;
          material = new MetalMaterial(albedo, fuzz);
        } else {
          // glass
          material = new DielectricMaterial(1.0 + Math.random());
        }

        const sphere = new Sphere(center, 0.2, material);
        objects.push(sphere);
      }
    }

    const material1 = new DielectricMaterial(1.5);
    const sphere1 = new Sphere(new Vec3(0, 1, 0), 1, material1);
    objects.push(sphere1);
    const material2 = new LambertianMaterial(new Color(0.4, 0.2, 0.1));
    const sphere2 = new Sphere(new Vec3(-4, 1, 0), 1, material2);
    objects.push(sphere2);
    const material3 = new MetalMaterial(new Color(0.7, 0.6, 0.5), 0.0);
    const sphere3 = new Sphere(new Vec3(4, 1, 0), 1, material3);
    objects.push(sphere3);
    objects.push(sunSphere);

    return objects;
  }

  // time in seconds
  getCameraData(time: number = 8.45): Float32Array {
    // const lookFrom = [13, 2, 3]; // camera position

    // rotate camera around origin
    const angle = (time / 40) * Math.PI * 2;
    const radius = Math.sqrt(13 * 13 + 3 * 3);
    const lookFrom = new Vec3(
      radius * Math.sin(angle),
      2,
      radius * Math.cos(angle),
    );
    const lookAt = new Vec3(0, 0, 0);
    const vup = new Vec3(0, 1, 0);
    const camera = new Camera(lookFrom, lookAt, vup);
    camera.vfov = 20.0 * (Math.PI / 180.0);
    camera.defocus_angle = 0.6 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
    camera.focus_dist = 10.0; // distance from camera lookFrom point to plane of perfect focus
    return new Float32Array(camera.getCamera());
  }
}

export class CornellBoxScene extends Scene {
  getObjectsArray(): BoundingBox[] {
    const objects: BoundingBox[] = [];

    const redMaterial = new LambertianMaterial(new Color(0.65, 0.05, 0.05));
    const whiteMaterial = new LambertianMaterial(new Color(0.73, 0.73, 0.73));
    const greenMaterial = new LambertianMaterial(new Color(0.12, 0.45, 0.15));
    const lightMaterial = new EmissiveMaterial(new Color(1.0, 1.0, 1.0), 15.0);
    const mirrorMaterial = new MetalMaterial(new Color(1.0, 1.0, 1.0), 0.0);

    // Create the walls of the Cornell Box
    // Left wall
    objects.push(
      new Quadrilateral(
        new Vec3(555, 0, 0), // corner
        new Vec3(0, 555, 0), // u vector
        new Vec3(0, 0, 555), // v vector
        redMaterial // material
      )
    );

    // Right wall
    objects.push(
      new Quadrilateral(
        new Vec3(0, 0, 0), // corner
        new Vec3(0, 555, 0), // u vector
        new Vec3(0, 0, 555), // v vector
        greenMaterial // material
      )
    );

    // Add ceiling light
    objects.push(
      new Quadrilateral(
        new Vec3(343, 554, 332), // corner
        new Vec3(-130, 0, 0), // u vector
        new Vec3(0, 0, -105), // v vector
        lightMaterial // material
      )
    );
    // Floor
    objects.push(
      new Quadrilateral(
        new Vec3(0, 0, 0), // corner
        new Vec3(555, 0, 0), // u vector
        new Vec3(0, 0, 555), // v vector
        whiteMaterial // material
      )
    );
    // Ceiling
    objects.push(
      new Quadrilateral(
        new Vec3(555, 555, 555), // corner
        new Vec3(-555, 0, 0), // u vector
        new Vec3(0, 0, -555), // v vector
        whiteMaterial // material
      )
    );
    // Back wall
    objects.push(
      new Quadrilateral(
        new Vec3(0, 0, 555), // corner
        new Vec3(555, 0, 0), // u vector
        new Vec3(0, 555, 0), // v vector
        whiteMaterial // material
      )
    );

    // Add boxes
    const cornellTallBlock = new Box(
      new Vec3(314, 0, 456), // min corner
      new Vec3(0, 330, 0), // u vector
      new Vec3(160, 0, -50), // v vector
      new Vec3(-50, 0, -160), // w vector
      mirrorMaterial // material
    );
    objects.push(...cornellTallBlock.getBoundingBoxes());

    const cornellShortBlock = new Box(
      new Vec3(130, 0, 65), // min corner
      new Vec3(0, 165, 0), // u vector
      new Vec3(160, 0, 50), // v vector
      new Vec3(-50, 0, 160), // w vector
      whiteMaterial // material
    );
    objects.push(...cornellShortBlock.getBoundingBoxes())

    return objects;
  }

  getCameraData(_time: number = 0.0): Float32Array {
    const lookFrom = new Vec3(278, 273, -800); // camera position
    const lookAt = new Vec3(278, 273, 0); // point to look at
    const vup = new Vec3(0, 1, 0);
    const camera = new Camera(lookFrom, lookAt, vup);
    camera.vfov = 40.0 * (Math.PI / 180.0);
    camera.defocus_angle = 0.0 * (Math.PI / 180.0); // variation angle of rays through each pixel in radians
    camera.focus_dist = 10.0; // distance from camera lookFrom point to plane of perfect focus
    return new Float32Array(camera.getCamera());
  }
}