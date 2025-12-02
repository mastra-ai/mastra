"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the number of keys in the specified hash slot
     * @param parser - The Redis command parser
     * @param slot - The hash slot to check
     */
    parseCommand(parser, slot) {
        parser.push('CLUSTER', 'COUNTKEYSINSLOT', slot.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_COUNTKEYSINSLOT.js.map