export class Vec3{
    readonly x: number;
    readonly y: number;
    readonly z: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    getVec3(): number[] {
        return [this.x, this.y, this.z];
    }

    distanceTo(other: Vec3): number {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        const dz = this.z - other.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    add(other: Vec3): Vec3 {
        return new Vec3(this.x + other.x, this.y + other.y, this.z + other.z);
    }

    subtract(other: Vec3): Vec3 {
        return new Vec3(this.x - other.x, this.y - other.y, this.z - other.z);
    }

    scale(scalar: number): Vec3 {
        return new Vec3(this.x * scalar, this.y * scalar, this.z * scalar);
    }

    negate(): Vec3 {
        return new Vec3(-this.x, -this.y, -this.z);
    }

    rotate(angle: number, axis: Vec3): Vec3 {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dot = this.x * axis.x + this.y * axis.y + this.z * axis.z;
        const crossX = this.y * axis.z - this.z * axis.y;
        const crossY = this.z * axis.x - this.x * axis.z;
        const crossZ = this.x * axis.y - this.y * axis.x;

        return new Vec3(
            this.x * cos + crossX * sin + axis.x * dot * (1 - cos),
            this.y * cos + crossY * sin + axis.y * dot * (1 - cos),
            this.z * cos + crossZ * sin + axis.z * dot * (1 - cos)
        );
    }

    at(index: number): number {
        switch (index) {
            case 0:
                return this.x;
            case 1:
                return this.y;
            case 2:
                return this.z;
            default:
                throw new Error('Index out of bounds');
        }
    }

    static min(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(
            Math.min(a.x, b.x),
            Math.min(a.y, b.y),
            Math.min(a.z, b.z)
        );
    }

    static max(a: Vec3, b: Vec3): Vec3 {
        return new Vec3(
            Math.max(a.x, b.x),
            Math.max(a.y, b.y),
            Math.max(a.z, b.z)
        );
    }
}