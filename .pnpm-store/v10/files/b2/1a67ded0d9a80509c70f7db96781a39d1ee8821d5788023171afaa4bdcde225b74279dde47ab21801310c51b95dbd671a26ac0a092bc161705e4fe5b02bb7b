"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const ZRANGE_1 = __importDefault(require("./ZRANGE"));
exports.default = {
    CACHEABLE: ZRANGE_1.default.CACHEABLE,
    IS_READ_ONLY: ZRANGE_1.default.IS_READ_ONLY,
    /**
     * Returns the specified range of elements in the sorted set with their scores.
     * @param args - Same parameters as the ZRANGE command.
     */
    parseCommand(...args) {
        const parser = args[0];
        ZRANGE_1.default.parseCommand(...args);
        parser.push('WITHSCORES');
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZRANGE_WITHSCORES.js.map