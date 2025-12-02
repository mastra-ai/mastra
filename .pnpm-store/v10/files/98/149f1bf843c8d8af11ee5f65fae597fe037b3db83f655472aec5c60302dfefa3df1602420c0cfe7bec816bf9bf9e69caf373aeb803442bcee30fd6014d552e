"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Assigns hash slots to the current node in a Redis Cluster
     * @param parser - The Redis command parser
     * @param slots - One or more hash slots to be assigned
     */
    parseCommand(parser, slots) {
        parser.push('CLUSTER', 'ADDSLOTS');
        parser.pushVariadicNumber(slots);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_ADDSLOTS.js.map