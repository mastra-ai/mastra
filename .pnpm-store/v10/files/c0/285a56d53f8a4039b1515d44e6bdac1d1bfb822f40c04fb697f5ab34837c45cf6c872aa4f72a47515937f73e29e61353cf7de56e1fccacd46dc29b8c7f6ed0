"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Deletes all hash slots from the current node in a Redis Cluster
     * @param parser - The Redis command parser
     */
    parseCommand(parser) {
        parser.push('CLUSTER', 'FLUSHSLOTS');
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_FLUSHSLOTS.js.map