"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PFCOUNT command
     *
     * @param parser - The command parser
     * @param keys - One or more keys of HyperLogLog structures to count
     * @see https://redis.io/commands/pfcount/
     */
    parseCommand(parser, keys) {
        parser.push('PFCOUNT');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=PFCOUNT.js.map