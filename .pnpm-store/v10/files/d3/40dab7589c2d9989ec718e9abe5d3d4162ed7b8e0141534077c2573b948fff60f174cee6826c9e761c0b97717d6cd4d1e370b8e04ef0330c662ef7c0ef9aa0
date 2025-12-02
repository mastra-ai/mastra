"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGeoRadiusWithArguments = void 0;
const GEORADIUS_1 = __importStar(require("./GEORADIUS"));
const GEOSEARCH_WITH_1 = __importDefault(require("./GEOSEARCH_WITH"));
function parseGeoRadiusWithArguments(parser, key, from, radius, unit, replyWith, options) {
    (0, GEORADIUS_1.parseGeoRadiusArguments)(parser, key, from, radius, unit, options);
    parser.pushVariadic(replyWith);
    parser.preserve = replyWith;
}
exports.parseGeoRadiusWithArguments = parseGeoRadiusWithArguments;
exports.default = {
    IS_READ_ONLY: GEORADIUS_1.default.IS_READ_ONLY,
    /**
     * Queries members in a geospatial index based on a radius from a center point with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Center coordinates for the search
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param replyWith - Information to include with each returned member
     * @param options - Additional search options
     */
    parseCommand(parser, key, from, radius, unit, replyWith, options) {
        parser.push('GEORADIUS');
        parseGeoRadiusWithArguments(parser, key, from, radius, unit, replyWith, options);
    },
    transformReply: GEOSEARCH_WITH_1.default.transformReply
};
//# sourceMappingURL=GEORADIUS_WITH.js.map