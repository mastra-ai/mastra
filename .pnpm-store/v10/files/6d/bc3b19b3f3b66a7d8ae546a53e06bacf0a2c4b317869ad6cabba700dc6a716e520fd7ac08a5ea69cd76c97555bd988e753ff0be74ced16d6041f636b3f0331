"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Assigns hash slot ranges to the current node in a Redis Cluster
     * @param parser - The Redis command parser
     * @param ranges - One or more slot ranges to be assigned, each specified as [start, end]
     */
    parseCommand(parser, ranges) {
        parser.push('CLUSTER', 'ADDSLOTSRANGE');
        (0, generic_transformers_1.parseSlotRangesArguments)(parser, ranges);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_ADDSLOTSRANGE.js.map