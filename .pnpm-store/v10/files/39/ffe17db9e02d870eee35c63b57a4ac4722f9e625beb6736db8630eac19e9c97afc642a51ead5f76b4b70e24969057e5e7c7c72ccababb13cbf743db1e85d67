"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transformRankArguments = void 0;
function transformRankArguments(parser, key, values) {
    parser.pushKey(key);
    for (const value of values) {
        parser.push(value.toString());
    }
}
exports.transformRankArguments = transformRankArguments;
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the rank of one or more values in a t-digest sketch (number of values that are lower than each value)
     * @param parser - The command parser
     * @param key - The name of the t-digest sketch
     * @param values - Array of values to get ranks for
     */
    parseCommand(...args) {
        args[0].push('TDIGEST.RANK');
        transformRankArguments(...args);
    },
    transformReply: undefined
};
//# sourceMappingURL=RANK.js.map