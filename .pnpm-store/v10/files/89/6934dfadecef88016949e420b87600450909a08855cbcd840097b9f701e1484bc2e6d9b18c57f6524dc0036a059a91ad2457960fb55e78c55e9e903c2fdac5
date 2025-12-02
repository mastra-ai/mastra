"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the ID of the client to which the current client is redirecting tracking notifications
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLIENT', 'GETREDIR');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLIENT_GETREDIR.js.map