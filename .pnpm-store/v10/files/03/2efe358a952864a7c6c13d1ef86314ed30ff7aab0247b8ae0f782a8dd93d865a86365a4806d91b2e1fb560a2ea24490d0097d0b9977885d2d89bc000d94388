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
Object.defineProperty(exports, "__esModule", { value: true });
const GEORADIUSBYMEMBER_1 = __importStar(require("./GEORADIUSBYMEMBER"));
exports.default = {
    IS_READ_ONLY: GEORADIUSBYMEMBER_1.default.IS_READ_ONLY,
    /**
     * Queries members in a geospatial index based on a radius from a member and stores the results
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param destination - Key to store the results
     * @param options - Additional search and storage options
     */
    parseCommand(parser, key, from, radius, unit, destination, options) {
        parser.push('GEORADIUSBYMEMBER');
        (0, GEORADIUSBYMEMBER_1.parseGeoRadiusByMemberArguments)(parser, key, from, radius, unit, options);
        if (options?.STOREDIST) {
            parser.push('STOREDIST');
            parser.pushKey(destination);
        }
        else {
            parser.push('STORE');
            parser.pushKey(destination);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=GEORADIUSBYMEMBER_STORE.js.map