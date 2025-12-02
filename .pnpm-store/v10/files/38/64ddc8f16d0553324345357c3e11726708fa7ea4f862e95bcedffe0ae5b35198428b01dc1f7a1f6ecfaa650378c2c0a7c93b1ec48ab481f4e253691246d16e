"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeoRadiusArguments = void 0;
const GEOSEARCH_1 = require("./GEOSEARCH");
function parseGeoRadiusArguments(parser, key, from, radius, unit, options) {
    parser.pushKey(key);
    parser.push(from.longitude.toString(), from.latitude.toString(), radius.toString(), unit);
    (0, GEOSEARCH_1.parseGeoSearchOptions)(parser, options);
}
exports.parseGeoRadiusArguments = parseGeoRadiusArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Queries members in a geospatial index based on a radius from a center point
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param options - Additional search options
     */
    parseCommand(...args) {
        args[0].push('GEORADIUS');
        return parseGeoRadiusArguments(...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=GEORADIUS.js.map