"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the number of failure reports for a given node
     * @param parser - The Redis command parser
     * @param nodeId - The ID of the node to check
     */
    parseCommand(parser, nodeId) {
        parser.push('CLUSTER', 'COUNT-FAILURE-REPORTS', nodeId);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_COUNT-FAILURE-REPORTS.js.map