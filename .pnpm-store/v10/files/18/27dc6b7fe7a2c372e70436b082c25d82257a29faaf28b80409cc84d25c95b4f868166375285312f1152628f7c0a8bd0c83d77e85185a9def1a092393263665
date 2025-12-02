"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Creates or modifies ACL user with specified rules
     * @param parser - The Redis command parser
     * @param username - Username to create or modify
     * @param rule - ACL rule(s) to apply to the user
     */
    parseCommand(parser, username, rule) {
        parser.push('ACL', 'SETUSER', username);
        parser.pushVariadic(rule);
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_SETUSER.js.map