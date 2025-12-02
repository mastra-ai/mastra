"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Removes hash slots from the current node in a Redis Cluster
     * @param parser - The Redis command parser
     * @param slots - One or more hash slots to be removed
     */
    parseCommand(parser, slots) {
        parser.push('CLUSTER', 'DELSLOTS');
        parser.pushVariadicNumber(slots);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_DELSLOTS.js.map