"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SRANDMEMBER_1 = __importDefault(require("./SRANDMEMBER"));
exports.default = {
    IS_READ_ONLY: SRANDMEMBER_1.default.IS_READ_ONLY,
    /**
     * Constructs the SRANDMEMBER command to get multiple random members from a set
     *
     * @param parser - The command parser
     * @param key - The key of the set to get random members from
     * @param count - The number of members to return. If negative, may return the same member multiple times
     * @see https://redis.io/commands/srandmember/
     */
    parseCommand(parser, key, count) {
        SRANDMEMBER_1.default.parseCommand(parser, key);
        parser.push(count.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=SRANDMEMBER_COUNT.js.map