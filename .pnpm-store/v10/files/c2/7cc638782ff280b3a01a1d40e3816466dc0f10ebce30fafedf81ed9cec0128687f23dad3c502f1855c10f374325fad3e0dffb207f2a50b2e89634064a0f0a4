"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Forces a Redis Cluster node to save the cluster configuration to disk
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLUSTER', 'SAVECONFIG');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_SAVECONFIG.js.map