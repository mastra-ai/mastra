"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Begins an incremental save of a Cuckoo Filter. This is useful for large filters that can't be saved at once
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter to save
     * @param iterator - Iterator value; Start at 0, and use the iterator from the response for the next chunk
     */
    parseCommand(parser, key, iterator) {
        parser.push('CF.SCANDUMP');
        parser.pushKey(key);
        parser.push(iterator.toString());
    },
    transformReply(reply) {
        return {
            iterator: reply[0],
            chunk: reply[1]
        };
    }
};
//# sourceMappingURL=SCANDUMP.js.map