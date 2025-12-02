"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the LSET command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param index - The index of the element to replace
     * @param element - The new value to set
     * @see https://redis.io/commands/lset/
     */
    parseCommand(parser, key, index, element) {
        parser.push('LSET');
        parser.pushKey(key);
        parser.push(index.toString(), element);
    },
    transformReply: undefined
};
//# sourceMappingURL=LSET.js.map