"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
const SUGGET_1 = __importDefault(require("./SUGGET"));
exports.default = {
    IS_READ_ONLY: SUGGET_1.default.IS_READ_ONLY,
    /**
     * Gets completion suggestions with their scores and payloads from a suggestion dictionary.
     * @param args - Same parameters as FT.SUGGET:
     *   - parser: The command parser
     *   - key: The suggestion dictionary key
     *   - prefix: The prefix to get completion suggestions for
     *   - options: Optional parameters for fuzzy matching and max results
     */
    parseCommand(...args) {
        SUGGET_1.default.parseCommand(...args);
        args[0].push('WITHSCORES', 'WITHPAYLOADS');
    },
    transformReply: {
        2: (reply, preserve, typeMapping) => {
            if ((0, generic_transformers_1.isNullReply)(reply))
                return null;
            const transformedReply = new Array(reply.length / 3);
            let replyIndex = 0, arrIndex = 0;
            while (replyIndex < reply.length) {
                transformedReply[arrIndex++] = {
                    suggestion: reply[replyIndex++],
                    score: generic_transformers_1.transformDoubleReply[2](reply[replyIndex++], preserve, typeMapping),
                    payload: reply[replyIndex++]
                };
            }
            return transformedReply;
        },
        3: (reply) => {
            if ((0, generic_transformers_1.isNullReply)(reply))
                return null;
            const transformedReply = new Array(reply.length / 3);
            let replyIndex = 0, arrIndex = 0;
            while (replyIndex < reply.length) {
                transformedReply[arrIndex++] = {
                    suggestion: reply[replyIndex++],
                    score: reply[replyIndex++],
                    payload: reply[replyIndex++]
                };
            }
            return transformedReply;
        }
    }
};
//# sourceMappingURL=SUGGET_WITHSCORES_WITHPAYLOADS.js.map