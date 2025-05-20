export class Vec3{
    private x: number;
    private y: number;
    private z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    getVec3(): number[] {
        return [this.x, this.y, this.z];
    }
}