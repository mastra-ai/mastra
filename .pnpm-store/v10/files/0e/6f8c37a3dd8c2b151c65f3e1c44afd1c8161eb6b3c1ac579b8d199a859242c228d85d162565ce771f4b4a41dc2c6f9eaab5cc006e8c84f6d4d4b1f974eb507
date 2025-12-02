"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the shard ID of the current Redis Cluster node
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLUSTER', 'MYSHARDID');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_MYSHARDID.js.map