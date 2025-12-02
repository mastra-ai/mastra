"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Parses the arguments for the `HPEXPIREAT` command.
     *
     * @param parser - The command parser instance.
     * @param key - The key of the hash.
     * @param fields - The fields to set the expiration for.
     * @param timestamp - The expiration timestamp (Unix timestamp or Date object).
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT').
     */
    parseCommand(parser, key, fields, timestamp, mode) {
        parser.push('HPEXPIREAT');
        parser.pushKey(key);
        parser.push((0, generic_transformers_1.transformPXAT)(timestamp));
        if (mode) {
            parser.push(mode);
        }
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HPEXPIREAT.js.map