export declare abstract class Geometry {
    abstract hasZ: boolean;
    abstract hasM: boolean;
    abstract srid: number | null;
    abstract toWKT(indent?: number | null): string;
}
export declare class Point extends Geometry {
    x: number;
    y: number;
    z: number | null;
    m: number | null;
    srid: number | null;
    constructor(x: number, y: number, z?: number | null, m?: number | null, srid?: number | null);
    get hasZ(): boolean;
    get hasM(): boolean;
    toWKT(_indent?: number | null, _truncate?: number, depth?: number): string;
    equals(other: Point): boolean;
}
export declare class MultiPoint extends Geometry {
    geometries: Point[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: Point[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class LineString extends Geometry {
    points: Point[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(points: Point[], hasZ: boolean, hasM: boolean, srid: number | null);
    protected _validate(): void;
    protected static _wktName: string;
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class CircularString extends LineString {
    protected static _wktName: string;
    protected _validate(): void;
}
export declare class MultiLineString extends Geometry {
    geometries: LineString[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: LineString[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class CompoundCurve extends Geometry {
    geometries: (LineString | CircularString)[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: (LineString | CircularString)[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class MultiCurve extends Geometry {
    geometries: (LineString | CircularString | CompoundCurve)[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: (LineString | CircularString | CompoundCurve)[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class Polygon extends Geometry {
    rings: LineString[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(rings: LineString[], hasZ: boolean, hasM: boolean, srid: number | null);
    protected _validate(): void;
    protected static _wktName: string;
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class Triangle extends Polygon {
    protected static _wktName: string;
    protected _validate(): void;
}
export declare class CurvePolygon extends Geometry {
    geometries: (LineString | CircularString | CompoundCurve)[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: (LineString | CircularString | CompoundCurve)[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class MultiPolygon extends Geometry {
    geometries: Polygon[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: Polygon[], hasZ: boolean, hasM: boolean, srid: number | null);
    protected static _wktName: string;
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class PolyhedralSurface extends MultiPolygon {
    protected static _wktName: string;
}
export declare class TriangulatedIrregularNetwork extends MultiPolygon {
    protected static _wktName: string;
}
export declare class MultiSurface extends Geometry {
    geometries: (Polygon | CurvePolygon)[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: (Polygon | CurvePolygon)[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export type AnyGeometry = Point | LineString | CircularString | Polygon | Triangle | MultiPoint | MultiLineString | MultiPolygon | TriangulatedIrregularNetwork | PolyhedralSurface | GeometryCollection | CompoundCurve | MultiCurve | CurvePolygon | MultiSurface;
export declare class GeometryCollection extends Geometry {
    geometries: AnyGeometry[];
    hasZ: boolean;
    hasM: boolean;
    srid: number | null;
    constructor(geometries: AnyGeometry[], hasZ: boolean, hasM: boolean, srid: number | null);
    toWKT(indent?: number | null, truncate?: number, depth?: number): string;
}
export declare class Box2D {
    min: [number, number];
    max: [number, number];
    constructor(min: [number, number], max: [number, number]);
    toString(): string;
}
export declare class Box3D {
    min: [number, number, number];
    max: [number, number, number];
    constructor(min: [number, number, number], max: [number, number, number]);
    toString(): string;
}
