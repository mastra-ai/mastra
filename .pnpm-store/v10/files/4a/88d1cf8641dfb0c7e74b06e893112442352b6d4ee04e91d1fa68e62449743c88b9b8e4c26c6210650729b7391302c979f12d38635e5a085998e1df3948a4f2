"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Authenticates the connection using a password or username and password
     * @param parser - The Redis command parser
     * @param options - Authentication options containing username and/or password
     * @param options.username - Optional username for authentication
     * @param options.password - Password for authentication
     */
    parseCommand(parser, { username, password }) {
        parser.push('AUTH');
        if (username !== undefined) {
            parser.push(username);
        }
        parser.push(password);
    },
    transformReply: undefined
};
//# sourceMappingURL=AUTH.js.map