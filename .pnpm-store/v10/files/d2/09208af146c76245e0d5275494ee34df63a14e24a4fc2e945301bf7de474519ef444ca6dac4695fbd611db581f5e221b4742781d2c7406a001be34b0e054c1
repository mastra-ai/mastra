"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve the dimension of the vectors in a vector set
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @see https://redis.io/commands/vdim/
     */
    parseCommand(parser, key) {
        parser.push('VDIM');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=VDIM.js.map