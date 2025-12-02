"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets completion suggestions for a prefix from a suggestion dictionary.
     * @param parser - The command parser
     * @param key - The suggestion dictionary key
     * @param prefix - The prefix to get completion suggestions for
     * @param options - Optional parameters:
     *   - FUZZY: Enable fuzzy prefix matching
     *   - MAX: Maximum number of results to return
     */
    parseCommand(parser, key, prefix, options) {
        parser.push('FT.SUGGET');
        parser.pushKey(key);
        parser.push(prefix);
        if (options?.FUZZY) {
            parser.push('FUZZY');
        }
        if (options?.MAX !== undefined) {
            parser.push('MAX', options.MAX.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SUGGET.js.map