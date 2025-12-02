"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostgisBox3dCodec = exports.PostgisBox2dCodec = exports.PostgisGeometryCodec = void 0;
const postgis_1 = require("../datatypes/postgis");
const errors_1 = require("../errors");
const ifaces_1 = require("./ifaces");
class PostgisGeometryCodec extends ifaces_1.ScalarCodec {
    encode(buf, object, ctx) {
        if (ctx.hasOverload(this)) {
            const geomBuf = ctx.preEncode(this, object);
            buf.writeBytes(geomBuf);
        }
        else {
            if (!(object instanceof postgis_1.Geometry)) {
                throw new errors_1.InvalidArgumentError(`a Geometry object was expected, got "${object}"`);
            }
            const finalise = buf.writeDeferredSize();
            _encodeGeometry(buf, object);
            finalise();
        }
    }
    decode(buf, ctx) {
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, buf.consumeAsBuffer());
        }
        return _parseGeometry(buf);
    }
}
exports.PostgisGeometryCodec = PostgisGeometryCodec;
class PostgisBox2dCodec extends ifaces_1.ScalarCodec {
    encode(buf, object, ctx) {
        let min;
        let max;
        if (ctx.hasOverload(this)) {
            [min, max] = ctx.preEncode(this, object);
        }
        else {
            if (!(object instanceof postgis_1.Box2D)) {
                throw new errors_1.InvalidArgumentError(`a Box2D object was expected, got "${object}"`);
            }
            min = object.min;
            max = object.max;
        }
        const finalise = buf.writeDeferredSize();
        _encodeGeometry(buf, new postgis_1.Polygon([
            new postgis_1.LineString([
                new postgis_1.Point(min[0], min[1]),
                new postgis_1.Point(min[0], max[1]),
                new postgis_1.Point(max[0], max[1]),
                new postgis_1.Point(min[0], min[1]),
            ], false, false, null),
        ], false, false, null));
        finalise();
    }
    decode(buf, ctx) {
        const poly = _parseGeometry(buf);
        if (poly.constructor !== postgis_1.Polygon ||
            poly.hasZ ||
            poly.rings.length !== 1 ||
            poly.rings[0].points.length !== 5) {
            throw new errors_1.InternalClientError(`failed to decode ext::postgis::box2d type`);
        }
        const points = poly.rings[0].points;
        const min = [points[0].x, points[0].y];
        const max = [points[2].x, points[2].y];
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, [min, max]);
        }
        return new postgis_1.Box2D(min, max);
    }
}
exports.PostgisBox2dCodec = PostgisBox2dCodec;
class PostgisBox3dCodec extends ifaces_1.ScalarCodec {
    encode(buf, object, ctx) {
        let min;
        let max;
        if (ctx.hasOverload(this)) {
            [min, max] = ctx.preEncode(this, object);
        }
        else {
            if (!(object instanceof postgis_1.Box3D)) {
                throw new errors_1.InvalidArgumentError(`a Box3D object was expected, got "${object}"`);
            }
            min = object.min;
            max = object.max;
        }
        const finalise = buf.writeDeferredSize();
        _encodeGeometry(buf, new postgis_1.Polygon([
            new postgis_1.LineString([
                new postgis_1.Point(min[0], min[1], min[2]),
                new postgis_1.Point(min[0], max[1], max[2]),
                new postgis_1.Point(max[0], max[1], max[2]),
                new postgis_1.Point(min[0], min[1], min[2]),
            ], true, false, null),
        ], true, false, null));
        finalise();
    }
    decode(buf, ctx) {
        const poly = _parseGeometry(buf);
        let min;
        let max;
        if (poly.constructor === postgis_1.Polygon &&
            poly.rings.length === 1 &&
            poly.rings[0].points.length === 5) {
            const points = poly.rings[0].points;
            min = points[0];
            max = points[2];
        }
        else if (poly.constructor === postgis_1.PolyhedralSurface &&
            poly.geometries.length === 6 &&
            poly.geometries[0].rings.length === 1 &&
            poly.geometries[0].rings[0].points.length === 5) {
            min = poly.geometries[0].rings[0].points[0];
            max = poly.geometries[5].rings[0].points[2];
        }
        else {
            throw new errors_1.InternalClientError(`failed to decode ext::postgis::box3d type`);
        }
        if (ctx.hasOverload(this)) {
            return ctx.postDecode(this, [
                [min.x, min.y, min.z ?? 0],
                [max.x, max.y, max.z ?? 0],
            ]);
        }
        return new postgis_1.Box3D([min.x, min.y, min.z ?? 0], [max.x, max.y, max.z ?? 0]);
    }
}
exports.PostgisBox3dCodec = PostgisBox3dCodec;
const zFlag = 0x80000000;
const mFlag = 0x40000000;
const sridFlag = 0x20000000;
const allFlags = zFlag | mFlag | sridFlag;
function _parseGeometry(buf, srid = null) {
    const le = buf.readUInt8() === 1;
    let type = buf.readUInt32(le);
    const z = (type & zFlag) !== 0;
    const m = (type & mFlag) !== 0;
    if ((type & sridFlag) !== 0) {
        srid = buf.readUInt32(le);
    }
    type = type & ~allFlags;
    switch (type) {
        case 1:
            return _parsePoint(buf, le, z, m, srid);
        case 2:
            return _parseLineString(buf, postgis_1.LineString, le, z, m, srid);
        case 3:
            return _parsePolygon(buf, postgis_1.Polygon, le, z, m, srid);
        case 4:
            return _parseMultiPoint(buf, le, z, m, srid);
        case 5:
            return _parseMultiLineString(buf, le, z, m, srid);
        case 6:
            return _parseMultiPolygon(buf, postgis_1.MultiPolygon, le, z, m, srid);
        case 7:
            return _parseGeometryCollection(buf, le, z, m, srid);
        case 8:
            return _parseLineString(buf, postgis_1.CircularString, le, z, m, srid);
        case 9:
            return _parseCompoundCurve(buf, le, z, m, srid);
        case 10:
            return _parseMultiCurve(buf, postgis_1.CurvePolygon, le, z, m, srid);
        case 11:
            return _parseMultiCurve(buf, postgis_1.MultiCurve, le, z, m, srid);
        case 12:
            return _parseMultiSurface(buf, le, z, m, srid);
        case 15:
            return _parseMultiPolygon(buf, postgis_1.PolyhedralSurface, le, z, m, srid);
        case 16:
            return _parseMultiPolygon(buf, postgis_1.TriangulatedIrregularNetwork, le, z, m, srid);
        case 17:
            return _parsePolygon(buf, postgis_1.Triangle, le, z, m, srid);
        default:
            throw new Error(`unsupported wkb type: ${type}`);
    }
}
function _parsePoint(buf, le, z, m, srid) {
    return new postgis_1.Point(buf.readFloat64(le), buf.readFloat64(le), z ? buf.readFloat64(le) : null, m ? buf.readFloat64(le) : null, srid);
}
function _parseLineString(buf, cls, le, z, m, srid) {
    const pointCount = buf.readUInt32(le);
    const points = new Array(pointCount);
    for (let i = 0; i < pointCount; i++) {
        points[i] = _parsePoint(buf, le, z, m, srid);
    }
    return new cls(points, z, m, srid);
}
function _parsePolygon(buf, cls, le, z, m, srid) {
    const ringCount = buf.readUInt32(le);
    const rings = new Array(ringCount);
    for (let i = 0; i < ringCount; i++) {
        rings[i] = _parseLineString(buf, postgis_1.LineString, le, z, m, srid);
    }
    return new cls(rings, z, m, srid);
}
function _parseMultiPoint(buf, le, z, m, srid) {
    const pointCount = buf.readUInt32(le);
    const points = new Array(pointCount);
    for (let i = 0; i < pointCount; i++) {
        buf.discard(5);
        points[i] = _parsePoint(buf, le, z, m, srid);
    }
    return new postgis_1.MultiPoint(points, z, m, srid);
}
function _parseMultiLineString(buf, le, z, m, srid) {
    const lineStringCount = buf.readUInt32(le);
    const lineStrings = new Array(lineStringCount);
    for (let i = 0; i < lineStringCount; i++) {
        buf.discard(5);
        lineStrings[i] = _parseLineString(buf, postgis_1.LineString, le, z, m, srid);
    }
    return new postgis_1.MultiLineString(lineStrings, z, m, srid);
}
function _parseCompoundCurve(buf, le, z, m, srid) {
    const curveCount = buf.readUInt32(le);
    const curves = new Array(curveCount);
    for (let i = 0; i < curveCount; i++) {
        buf.discard(1);
        const type = buf.readUInt32(le) & ~allFlags;
        switch (type) {
            case 2:
                curves[i] = _parseLineString(buf, postgis_1.LineString, le, z, m, srid);
                break;
            case 8:
                curves[i] = _parseLineString(buf, postgis_1.CircularString, le, z, m, srid);
                break;
            default:
                throw new Error(`unexpected type ${type} in CompoundCurve`);
        }
    }
    return new postgis_1.CompoundCurve(curves, z, m, srid);
}
function _parseMultiCurve(buf, cls, le, z, m, srid) {
    const curveCount = buf.readUInt32(le);
    const curves = new Array(curveCount);
    for (let i = 0; i < curveCount; i++) {
        buf.discard(1);
        const type = buf.readUInt32(le) & ~allFlags;
        switch (type) {
            case 2:
                curves[i] = _parseLineString(buf, postgis_1.LineString, le, z, m, srid);
                break;
            case 8:
                curves[i] = _parseLineString(buf, postgis_1.CircularString, le, z, m, srid);
                break;
            case 9:
                curves[i] = _parseCompoundCurve(buf, le, z, m, srid);
                break;
            default:
                throw new Error(`unexpected type ${type} in MultiCurve/CurvePolygon`);
        }
    }
    return new cls(curves, z, m, srid);
}
function _parseMultiPolygon(buf, cls, le, z, m, srid) {
    const polyCls = cls === postgis_1.TriangulatedIrregularNetwork ? postgis_1.Triangle : postgis_1.Polygon;
    const polyCount = buf.readUInt32(le);
    const polys = new Array(polyCount);
    for (let i = 0; i < polyCount; i++) {
        buf.discard(5);
        polys[i] = _parsePolygon(buf, polyCls, le, z, m, srid);
    }
    return new cls(polys, z, m, srid);
}
function _parseMultiSurface(buf, le, z, m, srid) {
    const surfaceCount = buf.readUInt32(le);
    const surfaces = new Array(surfaceCount);
    for (let i = 0; i < surfaceCount; i++) {
        buf.discard(1);
        const type = buf.readUInt32(le) & ~allFlags;
        switch (type) {
            case 3:
                surfaces[i] = _parsePolygon(buf, postgis_1.Polygon, le, z, m, srid);
                break;
            case 10:
                surfaces[i] = _parseMultiCurve(buf, postgis_1.CurvePolygon, le, z, m, srid);
                break;
            default:
                throw new Error(`unexpected type ${type} in MultiSurface`);
        }
    }
    return new postgis_1.MultiSurface(surfaces, z, m, srid);
}
function _parseGeometryCollection(buf, le, z, m, srid) {
    const geometryCount = buf.readUInt32(le);
    const geometries = new Array(geometryCount);
    for (let i = 0; i < geometryCount; i++) {
        geometries[i] = _parseGeometry(buf, srid);
    }
    return new postgis_1.GeometryCollection(geometries, z, m, srid);
}
const geomTypes = new Map([
    [postgis_1.Point, 1],
    [postgis_1.LineString, 2],
    [postgis_1.Polygon, 3],
    [postgis_1.MultiPoint, 4],
    [postgis_1.MultiLineString, 5],
    [postgis_1.MultiPolygon, 6],
    [postgis_1.GeometryCollection, 7],
    [postgis_1.CircularString, 8],
    [postgis_1.CompoundCurve, 9],
    [postgis_1.CurvePolygon, 10],
    [postgis_1.MultiCurve, 11],
    [postgis_1.MultiSurface, 12],
    [postgis_1.PolyhedralSurface, 15],
    [postgis_1.TriangulatedIrregularNetwork, 16],
    [postgis_1.Triangle, 17],
]);
function _encodeGeometry(buf, geom) {
    buf.writeUInt8(0);
    const type = geomTypes.get(geom.constructor);
    if (!type) {
        throw new Error(`unknown geometry type ${geom}`);
    }
    buf.writeUInt32(type |
        (geom.hasZ ? zFlag : 0) |
        (geom.hasM ? mFlag : 0) |
        (geom.srid !== null ? sridFlag : 0));
    if (geom.srid !== null) {
        buf.writeUInt32(geom.srid);
    }
    if (geom instanceof postgis_1.Point) {
        _encodePoint(buf, geom);
        return;
    }
    if (geom instanceof postgis_1.LineString) {
        _encodeLineString(buf, geom);
        return;
    }
    if (geom instanceof postgis_1.Polygon) {
        buf.writeUInt32(geom.rings.length);
        for (const ring of geom.rings) {
            _encodeLineString(buf, ring);
        }
        return;
    }
    buf.writeUInt32(geom.geometries.length);
    for (const point of geom.geometries) {
        _encodeGeometry(buf, point);
    }
}
function _encodePoint(buf, point) {
    buf.writeFloat64(point.x);
    buf.writeFloat64(point.y);
    if (point.z !== null)
        buf.writeFloat64(point.z);
    if (point.m !== null)
        buf.writeFloat64(point.m);
}
function _encodeLineString(buf, linestring) {
    buf.writeUInt32(linestring.points.length);
    for (const point of linestring.points) {
        _encodePoint(buf, point);
    }
}
