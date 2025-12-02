"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Adds a suggestion string to an auto-complete suggestion dictionary.
     * @param parser - The command parser
     * @param key - The suggestion dictionary key
     * @param string - The suggestion string to add
     * @param score - The suggestion score used for sorting
     * @param options - Optional parameters:
     *   - INCR: If true, increment the existing entry's score
     *   - PAYLOAD: Optional payload to associate with the suggestion
     */
    parseCommand(parser, key, string, score, options) {
        parser.push('FT.SUGADD');
        parser.pushKey(key);
        parser.push(string, score.toString());
        if (options?.INCR) {
            parser.push('INCR');
        }
        if (options?.PAYLOAD) {
            parser.push('PAYLOAD', options.PAYLOAD);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SUGADD.js.map