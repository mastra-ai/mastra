"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Deletes an index and all associated documents.
     * @param parser - The command parser
     * @param index - Name of the index to delete
     * @param options - Optional parameters:
     *   - DD: Also delete the indexed documents themselves
     */
    parseCommand(parser, index, options) {
        parser.push('FT.DROPINDEX', index);
        if (options?.DD) {
            parser.push('DD');
        }
    },
    transformReply: {
        2: undefined,
        3: undefined
    }
};
//# sourceMappingURL=DROPINDEX.js.map