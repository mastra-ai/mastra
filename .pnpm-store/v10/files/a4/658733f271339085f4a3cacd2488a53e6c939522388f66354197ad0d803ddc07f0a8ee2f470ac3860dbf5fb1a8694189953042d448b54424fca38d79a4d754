"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the distinct values in a TAG field.
     * @param parser - The command parser
     * @param index - Name of the index
     * @param fieldName - Name of the TAG field to get values from
     */
    parseCommand(parser, index, fieldName) {
        parser.push('FT.TAGVALS', index, fieldName);
    },
    transformReply: {
        2: undefined,
        3: undefined
    }
};
//# sourceMappingURL=TAGVALS.js.map