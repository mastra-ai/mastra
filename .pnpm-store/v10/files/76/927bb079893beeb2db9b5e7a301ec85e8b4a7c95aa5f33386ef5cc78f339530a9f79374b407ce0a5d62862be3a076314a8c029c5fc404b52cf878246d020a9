"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Computes the difference between the first and all successive sorted sets and stores it in a new key.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param inputKeys - Keys of the sorted sets to find the difference between.
     */
    parseCommand(parser, destination, inputKeys) {
        parser.push('ZDIFFSTORE');
        parser.pushKey(destination);
        parser.pushKeysLength(inputKeys);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZDIFFSTORE.js.map