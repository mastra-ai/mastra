"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseWKT = parseWKT;
const postgis_1 = require("./postgis");
const sridRegex = /\s*SRID=([0-9]+)\s*;/iy;
const endRegex = /\s*$/y;
const geomTypes = [
    "POINT",
    "LINESTRING",
    "POLYGON",
    "MULTIPOINT",
    "MULTILINESTRING",
    "MULTIPOLYGON",
    "GEOMETRYCOLLECTION",
    "POLYHEDRALSURFACE",
    "TRIANGLE",
    "TIN",
    "CIRCULARSTRING",
    "COMPOUNDCURVE",
    "CURVEPOLYGON",
    "MULTICURVE",
    "MULTISURFACE",
];
const geomTypeRegex = new RegExp(`\\s*(${geomTypes.join("|")})`, "iy");
const zmFlagsRegex = /\s+(ZM|Z|M)/iy;
const emptyOrOpenRegex = /\s+(EMPTY)|\s*\(/iy;
const openRegex = /\s*\(/y;
const closeRegex = /\s*\)/y;
const commaRegex = /\s*,/y;
const _num = "-?[0-9]+(?:\\.[0-9]+)?";
const pointRegex = new RegExp(`\\s*(${_num})\\s+(${_num})(?:\\s+(${_num}))?(?:\\s+(${_num}))?`, "y");
function parseWKT(wkt) {
    let i = 0;
    let hasZ = null;
    let hasM = null;
    let srid = null;
    sridRegex.lastIndex = i;
    const _srid = sridRegex.exec(wkt);
    if (_srid) {
        srid = parseInt(_srid[1], 10);
        i += _srid[0].length;
    }
    const geom = _parseGeom();
    endRegex.lastIndex = i;
    if (endRegex.exec(wkt) === null) {
        throw createParseError(wkt, i, "expected end of wkt");
    }
    return geom;
    function _parseGeom(unnamedGeom = null, allowedGeoms = null) {
        geomTypeRegex.lastIndex = i;
        const _geomType = geomTypeRegex.exec(wkt);
        const type = (_geomType?.[1].toUpperCase() ??
            unnamedGeom);
        if (!type || (allowedGeoms && !allowedGeoms.includes(type))) {
            throw createParseError(wkt, i, `expected one of ${(allowedGeoms ? ["(", ...allowedGeoms] : geomTypes).join(", ")}`);
        }
        i += _geomType?.[0].length ?? 0;
        if (_geomType !== null) {
            zmFlagsRegex.lastIndex = i;
            const _zmFlags = zmFlagsRegex.exec(wkt);
            if (_zmFlags !== null) {
                const zm = _zmFlags[1].toLowerCase();
                hasZ = zm === "zm" || zm === "z";
                hasM = zm === "zm" || zm === "m";
                i += _zmFlags[0].length;
            }
            else {
                hasZ = null;
                hasM = null;
            }
        }
        const open = _geomType === null ? openRegex : emptyOrOpenRegex;
        open.lastIndex = i;
        const _emptyOrOpen = open.exec(wkt);
        if (_emptyOrOpen === null) {
            throw createParseError(wkt, i, _geomType === null ? `expected (` : `expected EMPTY or (`);
        }
        i += _emptyOrOpen[0].length;
        const empty = _emptyOrOpen[1] != null;
        let geom;
        switch (type) {
            case "POINT":
                geom = _parsePoint(empty);
                break;
            case "LINESTRING":
            case "CIRCULARSTRING":
                geom = _parseLineString(empty, type === "CIRCULARSTRING" ? postgis_1.CircularString : postgis_1.LineString);
                break;
            case "POLYGON":
            case "TRIANGLE":
                geom = _parsePolygon(empty, type === "TRIANGLE" ? postgis_1.Triangle : postgis_1.Polygon);
                break;
            case "MULTIPOINT":
                geom = new postgis_1.MultiPoint(empty ? [] : _parseCommaSep(() => _parseBracketedGeom(_parsePoint)), hasZ ?? false, hasM ?? false, srid);
                break;
            case "MULTILINESTRING":
                geom = new postgis_1.MultiLineString(empty
                    ? []
                    : _parseCommaSep(() => _parseBracketedGeom(_parseLineString)), hasZ ?? false, hasM ?? false, srid);
                break;
            case "MULTIPOLYGON":
            case "POLYHEDRALSURFACE":
            case "TIN":
                {
                    const Geom = type === "TIN"
                        ? postgis_1.TriangulatedIrregularNetwork
                        : type === "POLYHEDRALSURFACE"
                            ? postgis_1.PolyhedralSurface
                            : postgis_1.MultiPolygon;
                    geom = new Geom(empty
                        ? []
                        : _parseCommaSep(() => _parseBracketedGeom(() => _parsePolygon(false, type === "TIN" ? postgis_1.Triangle : postgis_1.Polygon))), hasZ ?? false, hasM ?? false, srid);
                }
                break;
            case "GEOMETRYCOLLECTION": {
                geom = new postgis_1.GeometryCollection(empty ? [] : _checkDimensions(() => _parseCommaSep(_parseGeom)), hasZ ?? false, hasM ?? false, srid);
                break;
            }
            case "COMPOUNDCURVE":
                {
                    const segments = empty
                        ? []
                        : _checkDimensions(() => _parseCommaSep(() => _parseGeom("LINESTRING", ["LINESTRING", "CIRCULARSTRING"])));
                    geom = new postgis_1.CompoundCurve(segments, hasZ ?? false, hasM ?? false, srid);
                }
                break;
            case "CURVEPOLYGON":
            case "MULTICURVE":
                {
                    const rings = empty
                        ? []
                        : _checkDimensions(() => _parseCommaSep(() => _parseGeom("LINESTRING", [
                            "LINESTRING",
                            "CIRCULARSTRING",
                            "COMPOUNDCURVE",
                        ])));
                    const Geom = type === "MULTICURVE" ? postgis_1.MultiCurve : postgis_1.CurvePolygon;
                    geom = new Geom(rings, hasZ ?? false, hasM ?? false, srid);
                }
                break;
            case "MULTISURFACE":
                {
                    const surfaces = empty
                        ? []
                        : _checkDimensions(() => _parseCommaSep(() => _parseGeom("POLYGON", ["POLYGON", "CURVEPOLYGON"])));
                    geom = new postgis_1.MultiSurface(surfaces, hasZ ?? false, hasM ?? false, srid);
                }
                break;
            default:
                assertNever(type, `unknown geometry type ${type}`);
        }
        if (!empty) {
            closeRegex.lastIndex = i;
            const _close = closeRegex.exec(wkt);
            if (_close === null) {
                throw createParseError(wkt, i, `expected )`);
            }
            i += _close[0].length;
        }
        return geom;
    }
    function _parsePoint(empty = false) {
        if (empty) {
            return new postgis_1.Point(NaN, NaN, hasZ ? NaN : null, hasM ? NaN : null, srid);
        }
        pointRegex.lastIndex = i;
        const coords = pointRegex.exec(wkt);
        if (coords === null) {
            throw createParseError(wkt, i, `expected between 2 to 4 coordinates`);
        }
        const x = parseFloat(coords[1]);
        const y = parseFloat(coords[2]);
        const z = coords[3] ? parseFloat(coords[3]) : null;
        const m = coords[4] ? parseFloat(coords[4]) : null;
        if (hasZ === null) {
            hasZ = z !== null;
            hasM = m !== null;
        }
        else {
            if (m === null) {
                if (hasZ && hasM) {
                    throw createParseError(wkt, i, `expected M coordinate`);
                }
            }
            else {
                if (!hasM) {
                    throw createParseError(wkt, i, `unexpected M coordinate`);
                }
            }
            if (z === null) {
                if (hasZ || hasM) {
                    throw createParseError(wkt, i, `expected ${hasZ ? "Z" : "M"} coordinate`);
                }
            }
            else {
                if (!hasZ && (!hasM || m !== null)) {
                    throw createParseError(wkt, i, `unexpected Z coordinate`);
                }
            }
        }
        i += coords[0].length;
        return new postgis_1.Point(x, y, hasZ ? z : null, hasZ ? m : z, srid);
    }
    function _parseLineString(empty = false, Geom = postgis_1.LineString) {
        return new Geom(empty ? [] : _parseCommaSep(_parsePoint), hasZ ?? false, hasM ?? false, srid);
    }
    function _parsePolygon(empty = false, Geom = postgis_1.Polygon) {
        return new Geom(empty ? [] : _parseCommaSep(() => _parseBracketedGeom(_parseLineString)), hasZ ?? false, hasM ?? false, srid);
    }
    function _parseCommaSep(parseGeom) {
        const geoms = [parseGeom()];
        while (true) {
            commaRegex.lastIndex = i;
            const comma = commaRegex.exec(wkt);
            if (comma === null) {
                break;
            }
            i += comma[0].length;
            geoms.push(parseGeom());
        }
        return geoms;
    }
    function _parseBracketedGeom(parseGeom) {
        openRegex.lastIndex = i;
        const open = openRegex.exec(wkt);
        if (open === null) {
            throw createParseError(wkt, i, `expected (`);
        }
        i += open[0].length;
        const geom = parseGeom();
        closeRegex.lastIndex = i;
        const close = closeRegex.exec(wkt);
        if (close === null) {
            throw createParseError(wkt, i, `expected )`);
        }
        i += close[0].length;
        return geom;
    }
    function _checkDimensions(parseChildren) {
        const parentZ = hasZ;
        const parentM = hasM;
        const geoms = parseChildren();
        hasZ = parentZ ?? geoms[0].hasZ ?? false;
        hasM = parentM ?? geoms[0].hasM ?? false;
        if (geoms.some((geom) => geom.hasZ !== hasZ || geom.hasM !== hasM)) {
            throw createParseError(wkt, i, `child geometries have mixed dimensions`);
        }
        return geoms;
    }
}
function createParseError(_wkt, index, error) {
    return new Error(`${error} at position ${index}`);
}
function assertNever(_type, message) {
    throw new Error(message);
}
