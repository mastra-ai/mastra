"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Reconfigures a node as a replica of the specified primary node
     * @param parser - The Redis command parser
     * @param nodeId - Node ID of the primary node to replicate
     */
    parseCommand(parser, nodeId) {
        parser.push('CLUSTER', 'REPLICATE', nodeId);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_REPLICATE.js.map