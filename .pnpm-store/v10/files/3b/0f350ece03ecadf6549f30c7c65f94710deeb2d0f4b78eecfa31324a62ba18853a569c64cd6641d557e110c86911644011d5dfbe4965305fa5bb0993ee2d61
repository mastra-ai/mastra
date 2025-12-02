"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PFADD command
     *
     * @param parser - The command parser
     * @param key - The key of the HyperLogLog
     * @param element - Optional elements to add
     * @see https://redis.io/commands/pfadd/
     */
    parseCommand(parser, key, element) {
        parser.push('PFADD');
        parser.pushKey(key);
        if (element) {
            parser.pushVariadic(element);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PFADD.js.map