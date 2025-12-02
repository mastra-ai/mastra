"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns all terms in a dictionary.
     * @param parser - The command parser
     * @param dictionary - Name of the dictionary to dump
     */
    parseCommand(parser, dictionary) {
        parser.push('FT.DICTDUMP', dictionary);
    },
    transformReply: {
        2: undefined,
        3: undefined
    }
};
//# sourceMappingURL=DICTDUMP.js.map