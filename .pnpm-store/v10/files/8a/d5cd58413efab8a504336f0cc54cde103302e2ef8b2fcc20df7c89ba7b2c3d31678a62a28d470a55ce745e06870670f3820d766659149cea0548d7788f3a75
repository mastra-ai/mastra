"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
const ZRANDMEMBER_COUNT_1 = __importDefault(require("./ZRANDMEMBER_COUNT"));
exports.default = {
    IS_READ_ONLY: ZRANDMEMBER_COUNT_1.default.IS_READ_ONLY,
    /**
     * Returns one or more random members with their scores from a sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param count - Number of members to return.
     */
    parseCommand(parser, key, count) {
        ZRANDMEMBER_COUNT_1.default.parseCommand(parser, key, count);
        parser.push('WITHSCORES');
    },
    transformReply: generic_transformers_1.transformSortedSetReply
};
//# sourceMappingURL=ZRANDMEMBER_COUNT_WITHSCORES.js.map