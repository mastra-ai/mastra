"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BLPOP_1 = __importDefault(require("./BLPOP"));
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Removes and returns the last element in a list, or blocks until one is available
     * @param parser - The Redis command parser
     * @param key - Key of the list to pop from, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    parseCommand(parser, key, timeout) {
        parser.push('BRPOP');
        parser.pushKeys(key);
        parser.push(timeout.toString());
    },
    transformReply: BLPOP_1.default.transformReply
};
//# sourceMappingURL=BRPOP.js.map