"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns serialized information about the nodes in a Redis Cluster
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLUSTER', 'NODES');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_NODES.js.map