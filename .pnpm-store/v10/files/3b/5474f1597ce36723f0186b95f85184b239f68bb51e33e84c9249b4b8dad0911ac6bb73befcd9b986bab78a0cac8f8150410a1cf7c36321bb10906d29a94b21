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
const GEORADIUSBYMEMBER_WITH_1 = __importStar(require("./GEORADIUSBYMEMBER_WITH"));
exports.default = {
    CACHEABLE: true,
    IS_READ_ONLY: true,
    /**
     * Read-only variant that queries members in a geospatial index based on a radius from a member with additional information
     * @param parser - The Redis command parser
     * @param key - Key of the geospatial index
     * @param from - Member name to use as center point
     * @param radius - Radius of the search area
     * @param unit - Unit of distance (m, km, ft, mi)
     * @param withValues - Information to include with each returned member
     */
    parseCommand(...args) {
        const parser = args[0];
        parser.push('GEORADIUSBYMEMBER_RO');
        (0, GEORADIUSBYMEMBER_WITH_1.parseGeoRadiusByMemberWithArguments)(...args);
    },
    transformReply: GEORADIUSBYMEMBER_WITH_1.default.transformReply
};
//# sourceMappingURL=GEORADIUSBYMEMBER_RO_WITH.js.map