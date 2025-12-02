"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    /**
     * Parses the arguments for the `HPEXPIRE` command.
     *
     * @param parser - The command parser instance.
     * @param key - The key of the hash.
     * @param fields - The fields to set the expiration for.
     * @param ms - The expiration time in milliseconds.
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT').
     */
    parseCommand(parser, key, fields, ms, mode) {
        parser.push('HPEXPIRE');
        parser.pushKey(key);
        parser.push(ms.toString());
        if (mode) {
            parser.push(mode);
        }
        parser.push('FIELDS');
        parser.pushVariadicWithLength(fields);
    },
    transformReply: undefined
};
//# sourceMappingURL=HPEXPIRE.js.map