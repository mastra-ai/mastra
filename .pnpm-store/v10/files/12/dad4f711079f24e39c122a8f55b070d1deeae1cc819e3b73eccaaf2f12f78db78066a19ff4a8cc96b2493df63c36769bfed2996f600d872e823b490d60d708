"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Adds terms to a dictionary.
     * @param parser - The command parser
     * @param dictionary - Name of the dictionary to add terms to
     * @param term - One or more terms to add to the dictionary
     */
    parseCommand(parser, dictionary, term) {
        parser.push('FT.DICTADD', dictionary);
        parser.pushVariadic(term);
    },
    transformReply: undefined
};
//# sourceMappingURL=DICTADD.js.map