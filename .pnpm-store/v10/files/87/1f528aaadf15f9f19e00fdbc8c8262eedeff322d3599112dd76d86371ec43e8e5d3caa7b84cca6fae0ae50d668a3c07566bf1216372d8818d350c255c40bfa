"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Simulates ACL operations without executing them
     * @param parser - The Redis command parser
     * @param username - Username to simulate ACL operations for
     * @param command - Command arguments to simulate
     */
    parseCommand(parser, username, command) {
        parser.push('ACL', 'DRYRUN', username, ...command);
    },
    transformReply: undefined
};
//# sourceMappingURL=ACL_DRYRUN.js.map