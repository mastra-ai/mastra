"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeoRadiusByMemberWithArguments = void 0;
const GEORADIUSBYMEMBER_1 = __importDefault(require("./GEORADIUSBYMEMBER"));
const GEOSEARCH_1 = require("./GEOSEARCH");
const GEOSEARCH_WITH_1 = __importDefault(require("./GEOSEARCH_WITH"));
function parseGeoRadiusByMemberWithArguments(parser, key, from, radius, unit, replyWith, options) {
    parser.pushKey(key);
    parser.push(from, radius.toString(), unit);
    (0, GEOSEARCH_1.parseGeoSearchOptions)(parser, options);
    parser.push(...replyWith);
    parser.preserve = replyWith;
}
exports.parseGeoRadiusByMemberWithArguments = parseGeoRadiusByMemberWithArguments;
exports.default = {
    IS_READ_ONLY: GEORADIUSBYMEMBER_1.default.IS_READ_ONLY,
    /**
     * Queries members in a geospatial index based on a radius from a member with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    parseCommand(parser, key, from, radius, unit, replyWith, options) {
        parser.push('GEORADIUSBYMEMBER');
        parseGeoRadiusByMemberWithArguments(parser, key, from, radius, unit, replyWith, options);
    },
    transformReply: GEOSEARCH_WITH_1.default.transformReply
};
//# sourceMappingURL=GEORADIUSBYMEMBER_WITH.js.map