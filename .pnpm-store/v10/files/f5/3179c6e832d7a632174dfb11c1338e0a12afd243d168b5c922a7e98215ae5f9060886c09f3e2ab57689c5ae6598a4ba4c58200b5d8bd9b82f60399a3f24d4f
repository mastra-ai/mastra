"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Deletes a string from a suggestion dictionary.
     * @param parser - The command parser
     * @param key - The suggestion dictionary key
     * @param string - The suggestion string to delete
     */
    parseCommand(parser, key, string) {
        parser.push('FT.SUGDEL');
        parser.pushKey(key);
        parser.push(string);
    },
    transformReply: undefined
};
//# sourceMappingURL=SUGDEL.js.map