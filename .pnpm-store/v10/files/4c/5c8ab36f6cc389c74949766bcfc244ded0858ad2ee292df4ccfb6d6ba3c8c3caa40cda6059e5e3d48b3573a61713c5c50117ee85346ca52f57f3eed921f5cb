"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Deletes a cursor from an index.
     * @param parser - The command parser
     * @param index - The index name that contains the cursor
     * @param cursorId - The cursor ID to delete
     */
    parseCommand(parser, index, cursorId) {
        parser.push('FT.CURSOR', 'DEL', index, cursorId.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=CURSOR_DEL.js.map