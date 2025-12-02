"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Deletes a library and all its functions
     * @param parser - The Redis command parser
     * @param library - Name of the library to delete
     */
    parseCommand(parser, library) {
        parser.push('FUNCTION', 'DELETE', library);
    },
    transformReply: undefined
};
//# sourceMappingURL=FUNCTION_DELETE.js.map