"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Returns the hash slot number for a given key
     * @param parser - The Redis command parser
     * @param key - The key to get the hash slot for
     */
    parseCommand(parser, key) {
        parser.push('CLUSTER', 'KEYSLOT', key);
    },
    transformReply: undefined
};
//# sourceMappingURL=CLUSTER_KEYSLOT.js.map