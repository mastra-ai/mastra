"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeoRadiusByMemberArguments = void 0;
const GEOSEARCH_1 = require("./GEOSEARCH");
function parseGeoRadiusByMemberArguments(parser, key, from, radius, unit, options) {
    parser.pushKey(key);
    parser.push(from, radius.toString(), unit);
    (0, GEOSEARCH_1.parseGeoSearchOptions)(parser, options);
}
exports.parseGeoRadiusByMemberArguments = parseGeoRadiusByMemberArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Queries members in a geospatial index based on a radius from a member
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param options - Additional search options
     */
    parseCommand(parser, key, from, radius, unit, options) {
        parser.push('GEORADIUSBYMEMBER');
        parseGeoRadiusByMemberArguments(parser, key, from, radius, unit, options);
    },
    transformReply: undefined
};
//# sourceMappingURL=GEORADIUSBYMEMBER.js.map