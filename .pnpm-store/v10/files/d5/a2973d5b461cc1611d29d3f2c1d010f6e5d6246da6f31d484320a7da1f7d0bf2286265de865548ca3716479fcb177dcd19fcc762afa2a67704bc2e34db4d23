"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Sets the configuration epoch for a Redis Cluster node
     * @param parser - The Redis command parser
     * @param configEpoch - The configuration epoch to set
     */
    parseCommand(parser, configEpoch) {
        parser.push('CLUSTER', 'SET-CONFIG-EPOCH', configEpoch.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_SET-CONFIG-EPOCH.js.map