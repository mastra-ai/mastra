"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns information about the current connection's key tracking state
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLIENT', 'TRACKINGINFO');
    },
    transformReply: {
        2: (reply) => ({
            flags: reply[1],
            redirect: reply[3],
            prefixes: reply[5]
        }),
        3: undefined
    }
};
//# sourceMappingURL=CLIENT_TRACKINGINFO.js.map