"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Deletes terms from a dictionary.
     * @param parser - The command parser
     * @param dictionary - Name of the dictionary to remove terms from
     * @param term - One or more terms to delete from the dictionary
     */
    parseCommand(parser, dictionary, term) {
        parser.push('FT.DICTDEL', dictionary);
        parser.pushVariadic(term);
    },
    transformReply: undefined
};
//# sourceMappingURL=DICTDEL.js.map