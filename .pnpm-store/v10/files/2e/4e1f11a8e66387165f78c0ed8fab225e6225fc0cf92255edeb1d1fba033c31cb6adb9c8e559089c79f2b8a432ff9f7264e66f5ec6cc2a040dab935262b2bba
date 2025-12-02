"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the username of the current connection
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('ACL', 'WHOAMI');
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_WHOAMI.js.map