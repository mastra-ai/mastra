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
     * Gets completion suggestions with their payloads from a suggestion dictionary.
     * @param args - Same parameters as FT.SUGGET:
     *   - parser: The command parser
     *   - key: The suggestion dictionary key
     *   - prefix: The prefix to get completion suggestions for
     *   - options: Optional parameters for fuzzy matching and max results
     */
    parseCommand(...args) {
        SUGGET_1.default.parseCommand(...args);
        args[0].push('WITHPAYLOADS');
    },
    transformReply(reply) {
        if ((0, generic_transformers_1.isNullReply)(reply))
            return null;
        const transformedReply = new Array(reply.length / 2);
        let replyIndex = 0, arrIndex = 0;
        while (replyIndex < reply.length) {
            transformedReply[arrIndex++] = {
                suggestion: reply[replyIndex++],
                payload: reply[replyIndex++]
            };
        }
        return transformedReply;
    }
};
//# sourceMappingURL=SUGGET_WITHPAYLOADS.js.map