"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const ZRANGEBYSCORE_1 = __importDefault(require("./ZRANGEBYSCORE"));
exports.default = {
    CACHEABLE: ZRANGEBYSCORE_1.default.CACHEABLE,
    IS_READ_ONLY: ZRANGEBYSCORE_1.default.IS_READ_ONLY,
    /**
     * Returns all the elements in the sorted set with a score between min and max, with their scores.
     * @param args - Same parameters as the ZRANGEBYSCORE command.
     */
    parseCommand(...args) {
        const parser = args[0];
        ZRANGEBYSCORE_1.default.parseCommand(...args);
        parser.push('WITHSCORES');
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZRANGEBYSCORE_WITHSCORES.js.map