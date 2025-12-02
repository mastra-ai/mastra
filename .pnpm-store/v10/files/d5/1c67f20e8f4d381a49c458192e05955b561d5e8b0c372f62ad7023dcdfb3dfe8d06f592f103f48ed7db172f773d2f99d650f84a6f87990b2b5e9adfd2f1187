"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Asynchronously rewrites the append-only file
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('BGREWRITEAOF');
    },
    transformReply: undefined
};
//# sourceMappingURL=BGREWRITEAOF.js.map