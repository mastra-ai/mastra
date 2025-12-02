"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Handshakes with the Redis server and switches to the specified protocol version
     * @param parser - The Redis command parser
     * @param protover - Protocol version to use
     * @param options - Additional options for authentication and connection naming
     */
    parseCommand(parser, protover, options) {
        parser.push('HELLO');
        if (protover) {
            parser.push(protover.toString());
            if (options?.AUTH) {
                parser.push('AUTH', options.AUTH.username, options.AUTH.password);
            }
            if (options?.SETNAME) {
                parser.push('SETNAME', options.SETNAME);
            }
        }
    },
    transformReply: {
        2: (reply) => ({
            server: reply[1],
            version: reply[3],
            proto: reply[5],
            id: reply[7],
            mode: reply[9],
            role: reply[11],
            modules: reply[13]
        }),
        3: undefined
    }
};
//# sourceMappingURL=HELLO.js.map