"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the replica nodes replicating from the specified primary node
     * @param parser - The Redis command parser
     * @param nodeId - Node ID of the primary node
     */
    parseCommand(parser, nodeId) {
        parser.push('CLUSTER', 'REPLICAS', nodeId);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_REPLICAS.js.map