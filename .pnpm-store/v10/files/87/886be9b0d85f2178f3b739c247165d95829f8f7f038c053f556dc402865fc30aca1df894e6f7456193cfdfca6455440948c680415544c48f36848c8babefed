"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformByRankArguments = void 0;
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
function transformByRankArguments(parser, key, ranks) {
    parser.pushKey(key);
    for (const rank of ranks) {
        parser.push(rank.toString());
    }
}
exports.transformByRankArguments = transformByRankArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns value estimates for one or more ranks in a t-digest sketch
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param ranks - Array of ranks to get value estimates for (ascending order)
     */
    parseCommand(...args) {
        args[0].push('TDIGEST.BYRANK');
        transformByRankArguments(...args);
    },
    transformReply: generic_transformers_1.transformDoubleArrayReply
};
//# sourceMappingURL=BYRANK.js.map