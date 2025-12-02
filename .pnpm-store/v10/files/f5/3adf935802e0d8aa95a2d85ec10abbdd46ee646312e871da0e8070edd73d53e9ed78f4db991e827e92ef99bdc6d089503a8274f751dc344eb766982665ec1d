"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns ACL information about a specific user
     * @param parser - The Redis command parser
     * @param username - Username to get information for
     */
    parseCommand(parser, username) {
        parser.push('ACL', 'GETUSER', username);
    },
    transformReply: {
        2: (reply) => ({
            flags: reply[1],
            passwords: reply[3],
            commands: reply[5],
            keys: reply[7],
            channels: reply[9],
            selectors: reply[11]?.map(selector => {
                const inferred = selector;
                return {
                    commands: inferred[1],
                    keys: inferred[3],
                    channels: inferred[5]
                };
            })
        }),
        3: undefined
    }
};
//# sourceMappingURL=ACL_GETUSER.js.map