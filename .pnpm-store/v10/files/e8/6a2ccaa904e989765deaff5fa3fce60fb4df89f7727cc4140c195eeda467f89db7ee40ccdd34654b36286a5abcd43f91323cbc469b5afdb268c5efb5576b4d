"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Removes a node from the cluster
     * @param parser - The Redis command parser
     * @param nodeId - The ID of the node to remove
     */
    parseCommand(parser, nodeId) {
        parser.push('CLUSTER', 'FORGET', nodeId);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_FORGET.js.map