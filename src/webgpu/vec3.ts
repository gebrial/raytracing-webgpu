export class Vec3{
    public x: number;
    public y: number;
    public z: number;

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

    set(index: number, value: number): void {
        switch (index) {
            case 0:
                this.x = value;
                break;
            case 1:
                this.y = value;
                break;
            case 2:
                this.z = value;
                break;
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