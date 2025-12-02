"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Assigns a name to the current connection
     * @param parser - The Redis command parser
     * @param name - The name to assign to the connection
     */
    parseCommand(parser, name) {
        parser.push('CLIENT', 'SETNAME', name);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_SETNAME.js.map