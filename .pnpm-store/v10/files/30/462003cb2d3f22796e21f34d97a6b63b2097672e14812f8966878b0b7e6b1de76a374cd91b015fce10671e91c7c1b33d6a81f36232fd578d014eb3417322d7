"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the PEXPIREAT command
     *
     * @param parser - The command parser
     * @param key - The key to set the expiration for
     * @param msTimestamp - The expiration timestamp in milliseconds (Unix timestamp or Date object)
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT')
     * @see https://redis.io/commands/pexpireat/
     */
    parseCommand(parser, key, msTimestamp, mode) {
        parser.push('PEXPIREAT');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformPXAT)(msTimestamp));
        if (mode) {
            parser.push(mode);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=PEXPIREAT.js.map