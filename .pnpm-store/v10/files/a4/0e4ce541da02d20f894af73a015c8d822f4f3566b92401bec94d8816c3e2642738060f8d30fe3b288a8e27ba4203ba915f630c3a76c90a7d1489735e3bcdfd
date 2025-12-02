"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the difference between the first sorted set and all the successive sorted sets.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets.
     */
    parseCommand(parser, keys) {
        parser.push('ZDIFF');
        parser.pushKeysLength(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=ZDIFF.js.map