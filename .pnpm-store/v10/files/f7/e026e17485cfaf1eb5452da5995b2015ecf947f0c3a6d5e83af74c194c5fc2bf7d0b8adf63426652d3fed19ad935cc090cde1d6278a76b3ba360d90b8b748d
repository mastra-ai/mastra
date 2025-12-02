"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const ZINTER_1 = __importDefault(require("./ZINTER"));
exports.default = {
    IS_READ_ONLY: ZINTER_1.default.IS_READ_ONLY,
    /**
     * Intersects multiple sorted sets and returns the result with scores.
     * @param args - Same parameters as ZINTER command.
     */
    parseCommand(...args) {
        ZINTER_1.default.parseCommand(...args);
        args[0].push('WITHSCORES');
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZINTER_WITHSCORES.js.map