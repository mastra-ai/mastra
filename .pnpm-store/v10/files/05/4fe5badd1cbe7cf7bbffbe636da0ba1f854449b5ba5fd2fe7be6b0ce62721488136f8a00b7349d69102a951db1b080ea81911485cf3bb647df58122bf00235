"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Restores a Bloom Filter chunk previously saved using SCANDUMP
     * @param parser - The command parser
     * @param key - The name of the Bloom filter to restore
     * @param iterator - Iterator value from the SCANDUMP command
     * @param chunk - Data chunk from the SCANDUMP command
     */
    parseCommand(parser, key, iterator, chunk) {
        parser.push('BF.LOADCHUNK');
        parser.pushKey(key);
        parser.push(iterator.toString(), chunk);
    },
    transformReply: undefined
};
//# sourceMappingURL=LOADCHUNK.js.map