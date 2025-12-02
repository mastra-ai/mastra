"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Deletes one or more users from the ACL
     * @param parser - The Redis command parser
     * @param username - Username(s) to delete
     */
    parseCommand(parser, username) {
        parser.push('ACL', 'DELUSER');
        parser.pushVariadic(username);
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_DELUSER.js.map