"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Box3D = exports.Box2D = exports.GeometryCollection = exports.MultiSurface = exports.TriangulatedIrregularNetwork = exports.PolyhedralSurface = exports.MultiPolygon = exports.CurvePolygon = exports.Triangle = exports.Polygon = exports.MultiCurve = exports.CompoundCurve = exports.MultiLineString = exports.CircularString = exports.LineString = exports.MultiPoint = exports.Point = exports.Geometry = void 0;
class Geometry {
}
exports.Geometry = Geometry;
function _pointToWKT(p) {
    return `${p.x} ${p.y}${p.z !== null ? ` ${p.z}` : ""}${p.m !== null ? ` ${p.m}` : ""}`;
}
function _flagsToWKT(z, m) {
    return (z || m ? " " : "") + (z ? "Z" : "") + (m ? "M" : "");
}
function _sridWKTPrefix(srid, depth) {
    return srid !== null && depth === 0 ? `SRID=${srid}; ` : "";
}
function _indent(indent, depth) {
    if (!indent)
        return "";
    return "\n" + " ".repeat(indent * depth);
}
class Point extends Geometry {
    x;
    y;
    z;
    m;
    srid;
    constructor(x, y, z = null, m = null, srid = null) {
        super();
        this.x = x;
        this.y = y;
        this.z = z;
        this.m = m;
        this.srid = srid;
    }
    get hasZ() {
        return this.z !== null;
    }
    get hasM() {
        return this.m !== null;
    }
    toWKT(_indent, _truncate = Infinity, depth = 0) {
        return `${_sridWKTPrefix(this.srid, depth)}POINT${_flagsToWKT(this.z !== null, this.m !== null)} ${Number.isNaN(this.x) ? "EMPTY" : "(" + _pointToWKT(this) + ")"}`;
    }
    equals(other) {
        return (this.srid === other.srid &&
            (Number.isNaN(this.x)
                ? this.hasZ === other.hasZ && this.hasM === other.hasM
                : this.x === other.x &&
                    this.y === other.y &&
                    this.z === other.z &&
                    this.m === other.m));
    }
}
exports.Point = Point;
class MultiPoint extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}MULTIPOINT${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    "(" +
                    _pointToWKT(this.geometries[i++]) +
                    (i < this.geometries.length ? "), " : ")");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.MultiPoint = MultiPoint;
function _linestringToWKT(points, indent, truncate = Infinity, depth = 0) {
    let wkt = `(`;
    let i = 0;
    while (i < points.length && wkt.length < truncate) {
        wkt +=
            _indent(indent, depth + 1) +
                _pointToWKT(points[i++]) +
                (i < points.length ? ", " : "");
    }
    return wkt + _indent(indent, depth) + ")";
}
class LineString extends Geometry {
    points;
    hasZ;
    hasM;
    srid;
    constructor(points, hasZ, hasM, srid) {
        super();
        this.points = points;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
        this._validate();
    }
    _validate() {
        if (this.points.length === 1) {
            throw new Error(`expected zero, or 2 or more points in LineString`);
        }
    }
    static _wktName = "LINESTRING";
    toWKT(indent, truncate = Infinity, depth = 0) {
        const wkt = `${_sridWKTPrefix(this.srid, depth)}${this.constructor._wktName}${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.points.length === 0) {
            return wkt + "EMPTY";
        }
        return (wkt + _linestringToWKT(this.points, indent, truncate - wkt.length, depth));
    }
}
exports.LineString = LineString;
class CircularString extends LineString {
    static _wktName = "CIRCULARSTRING";
    _validate() {
        if (this.points.length !== 0 &&
            (this.points.length <= 1 || this.points.length % 2 !== 1)) {
            throw new Error(`expected zero points, or odd number of points greater than 1 in CircularString`);
        }
    }
}
exports.CircularString = CircularString;
function _multilinestringToWKT(lineStrings, indent, truncate = Infinity, depth = 0) {
    let wkt = `(`;
    let i = 0;
    while (i < lineStrings.length && wkt.length < truncate) {
        wkt +=
            _indent(indent, depth + 1) +
                _linestringToWKT(lineStrings[i++].points, indent, truncate - wkt.length, depth + 1) +
                (i < lineStrings.length ? ", " : "");
    }
    return wkt + _indent(indent, depth) + ")";
}
class MultiLineString extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        const wkt = `${_sridWKTPrefix(this.srid, depth)}MULTILINESTRING${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        return (wkt +
            _multilinestringToWKT(this.geometries, indent, truncate - wkt.length, depth));
    }
}
exports.MultiLineString = MultiLineString;
class CompoundCurve extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
        let lastPoint = null;
        for (const segment of geometries) {
            if (lastPoint && !segment.points[0].equals(lastPoint)) {
                throw new Error("segments in CompoundCurve do not join");
            }
            lastPoint = segment.points[segment.points.length - 1];
        }
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}COMPOUNDCURVE${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += "(";
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    (this.geometries[i] instanceof CircularString
                        ? "CIRCULARSTRING "
                        : "LINESTRING ") +
                    _linestringToWKT(this.geometries[i++].points, indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.CompoundCurve = CompoundCurve;
class MultiCurve extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}MULTICURVE${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    this.geometries[i++].toWKT(indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.MultiCurve = MultiCurve;
class Polygon extends Geometry {
    rings;
    hasZ;
    hasM;
    srid;
    constructor(rings, hasZ, hasM, srid) {
        super();
        this.rings = rings;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
        this._validate();
    }
    _validate() {
        if (this.rings.some((ring) => ring.points.length < 4 ||
            !ring.points[0].equals(ring.points[ring.points.length - 1]))) {
            throw new Error("expected rings in Polygon to be closed and to have at least 4 points");
        }
    }
    static _wktName = "POLYGON";
    toWKT(indent, truncate = Infinity, depth = 0) {
        const wkt = `${_sridWKTPrefix(this.srid, depth)}${this.constructor._wktName}${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.rings.length === 0) {
            return wkt + "EMPTY";
        }
        return (wkt +
            _multilinestringToWKT(this.rings, indent, truncate - wkt.length, depth));
    }
}
exports.Polygon = Polygon;
class Triangle extends Polygon {
    static _wktName = "TRIANGLE";
    _validate() {
        if (this.rings.length > 1) {
            throw new Error("Triangle can only contain a single ring");
        }
        if (this.rings.some((ring) => ring.points.length !== 4 ||
            !ring.points[0].equals(ring.points[ring.points.length - 1]))) {
            throw new Error("expected Triangle to be closed and to have exactly 4 points");
        }
    }
}
exports.Triangle = Triangle;
class CurvePolygon extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
        if (this.geometries.some((ring) => (ring instanceof LineString && ring.points.length < 4) ||
            (ring instanceof CompoundCurve
                ? !ring.geometries[0].points[0].equals(ring.geometries[ring.geometries.length - 1].points[ring.geometries[ring.geometries.length - 1].points.length - 1])
                : !ring.points[0].equals(ring.points[ring.points.length - 1])))) {
            throw new Error("expected rings in CurvePolygon to be closed and LinearRings to have at least 4 points");
        }
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}CURVEPOLYGON${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    this.geometries[i++].toWKT(indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.CurvePolygon = CurvePolygon;
class MultiPolygon extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    static _wktName = "MULTIPOLYGON";
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}${this.constructor._wktName}${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    _multilinestringToWKT(this.geometries[i++].rings, indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.MultiPolygon = MultiPolygon;
class PolyhedralSurface extends MultiPolygon {
    static _wktName = "POLYHEDRALSURFACE";
}
exports.PolyhedralSurface = PolyhedralSurface;
class TriangulatedIrregularNetwork extends MultiPolygon {
    static _wktName = "TIN";
}
exports.TriangulatedIrregularNetwork = TriangulatedIrregularNetwork;
class MultiSurface extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}MULTISURFACE${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    this.geometries[i++].toWKT(indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.MultiSurface = MultiSurface;
class GeometryCollection extends Geometry {
    geometries;
    hasZ;
    hasM;
    srid;
    constructor(geometries, hasZ, hasM, srid) {
        super();
        this.geometries = geometries;
        this.hasZ = hasZ;
        this.hasM = hasM;
        this.srid = srid;
    }
    toWKT(indent, truncate = Infinity, depth = 0) {
        let wkt = `${_sridWKTPrefix(this.srid, depth)}GEOMETRYCOLLECTION${_flagsToWKT(this.hasZ, this.hasM)} `;
        if (this.geometries.length === 0) {
            return wkt + "EMPTY";
        }
        wkt += `(`;
        let i = 0;
        while (i < this.geometries.length && wkt.length < truncate) {
            wkt +=
                _indent(indent, depth + 1) +
                    this.geometries[i++].toWKT(indent, truncate - wkt.length, depth + 1) +
                    (i < this.geometries.length ? ", " : "");
        }
        return wkt + _indent(indent, depth) + ")";
    }
}
exports.GeometryCollection = GeometryCollection;
class Box2D {
    min;
    max;
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
    toString() {
        return `BOX(${this.min[0]} ${this.min[1]}, ${this.max[0]} ${this.max[1]})`;
    }
}
exports.Box2D = Box2D;
class Box3D {
    min;
    max;
    constructor(min, max) {
        this.min = min;
        this.max = max;
    }
    toString() {
        return `BOX3D(${this.min[0]} ${this.min[1]} ${this.min[2]}, ${this.max[0]} ${this.max[1]} ${this.max[2]})`;
    }
}
exports.Box3D = Box3D;
