"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Constructs the REPLICAOF command
     *
     * @param parser - The command parser
     * @param host - The host of the master to replicate from
     * @param port - The port of the master to replicate from
     * @see https://redis.io/commands/replicaof/
     */
    parseCommand(parser, host, port) {
        parser.push('REPLICAOF', host, port.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=REPLICAOF.js.map