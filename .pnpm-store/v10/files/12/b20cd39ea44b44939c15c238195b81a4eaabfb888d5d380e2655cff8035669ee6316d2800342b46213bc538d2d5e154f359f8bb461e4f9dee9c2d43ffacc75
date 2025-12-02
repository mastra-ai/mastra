"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BZPOPMAX_1 = __importDefault(require("./BZPOPMAX"));
exports.default = {
    IS_READ_ONLY: BZPOPMAX_1.default.IS_READ_ONLY,
    /**
     * Removes and returns the member with the lowest score in a sorted set, or blocks until one is available
     * @param parser - The Redis command parser
     * @param keys - Key of the sorted set, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    parseCommand(parser, keys, timeout) {
        parser.push('BZPOPMIN');
        parser.pushKeys(keys);
        parser.push(timeout.toString());
    },
    transformReply: BZPOPMAX_1.default.transformReply
};
//# sourceMappingURL=BZPOPMIN.js.map