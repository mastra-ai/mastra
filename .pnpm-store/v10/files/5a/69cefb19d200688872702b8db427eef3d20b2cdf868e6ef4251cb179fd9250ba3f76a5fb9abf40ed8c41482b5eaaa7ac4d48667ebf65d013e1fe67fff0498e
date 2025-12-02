"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Restores libraries from the dump payload
     * @param parser - The Redis command parser
     * @param dump - Serialized payload of functions to restore
     * @param options - Options for the restore operation
     */
    parseCommand(parser, dump, options) {
        parser.push('FUNCTION', 'RESTORE', dump);
        if (options?.mode) {
            parser.push(options.mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=FUNCTION_RESTORE.js.map