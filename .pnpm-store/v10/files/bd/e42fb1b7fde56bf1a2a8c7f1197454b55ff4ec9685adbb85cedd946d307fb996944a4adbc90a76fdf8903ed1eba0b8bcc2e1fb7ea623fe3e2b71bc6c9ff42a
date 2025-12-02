"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Removes hash slot ranges from the current node in a Redis Cluster
     * @param parser - The Redis command parser
     * @param ranges - One or more slot ranges to be removed, each specified as [start, end]
     */
    parseCommand(parser, ranges) {
        parser.push('CLUSTER', 'DELSLOTSRANGE');
        (0, generic_transformers_1.parseSlotRangesArguments)(parser, ranges);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_DELSLOTSRANGE.js.map