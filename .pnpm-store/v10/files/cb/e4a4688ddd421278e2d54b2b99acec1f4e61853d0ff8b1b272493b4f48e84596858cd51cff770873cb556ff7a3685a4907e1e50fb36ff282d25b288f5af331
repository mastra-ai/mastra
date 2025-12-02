"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ZRANK_1 = __importDefault(require("./ZRANK"));
exports.default = {
    CACHEABLE: ZRANK_1.default.CACHEABLE,
    IS_READ_ONLY: ZRANK_1.default.IS_READ_ONLY,
    /**
     * Returns the rank of a member in the sorted set with its score.
     * @param args - Same parameters as the ZRANK command.
     */
    parseCommand(...args) {
        const parser = args[0];
        ZRANK_1.default.parseCommand(...args);
        parser.push('WITHSCORE');
    },
    transformReply: {
        2: (reply) => {
            if (reply === null)
                return null;
            return {
                rank: reply[0],
                score: Number(reply[1])
            };
        },
        3: (reply) => {
            if (reply === null)
                return null;
            return {
                rank: reply[0],
                score: reply[1]
            };
        }
    }
};
//# sourceMappingURL=ZRANK_WITHSCORE.js.map