"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Initiates a handshake with another node in the cluster
     * @param parser - The Redis command parser
     * @param host - Host name or IP address of the node
     * @param port - TCP port of the node
     */
    parseCommand(parser, host, port) {
        parser.push('CLUSTER', 'MEET', host, port.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_MEET.js.map