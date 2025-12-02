"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns a number of keys from the specified hash slot
     * @param parser - The Redis command parser
     * @param slot - The hash slot to get keys from
     * @param count - Maximum number of keys to return
     */
    parseCommand(parser, slot, count) {
        parser.push('CLUSTER', 'GETKEYSINSLOT', slot.toString(), count.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_GETKEYSINSLOT.js.map