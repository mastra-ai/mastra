"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const MSET_1 = require("./MSET");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the MSETNX command
     *
     * @param parser - The command parser
     * @param toSet - Key-value pairs to set if none of the keys exist (array of tuples, flat array, or object)
     * @see https://redis.io/commands/msetnx/
     */
    parseCommand(parser, toSet) {
        parser.push('MSETNX');
        return (0, MSET_1.parseMSetArguments)(parser, toSet);
    },
    transformReply: undefined
};
//# sourceMappingURL=MSETNX.js.map