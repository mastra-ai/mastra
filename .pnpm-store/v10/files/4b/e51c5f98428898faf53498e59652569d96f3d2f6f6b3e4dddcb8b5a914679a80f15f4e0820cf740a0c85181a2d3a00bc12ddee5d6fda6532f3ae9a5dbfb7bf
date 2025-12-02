"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the RESTORE command
     *
     * @param parser - The command parser
     * @param key - The key to restore
     * @param ttl - Time to live in milliseconds, 0 for no expiry
     * @param serializedValue - The serialized value from DUMP command
     * @param options - Options for the RESTORE command
     * @see https://redis.io/commands/restore/
     */
    parseCommand(parser, key, ttl, serializedValue, options) {
        parser.push('RESTORE');
        parser.pushKey(key);
        parser.push(ttl.toString(), serializedValue);
        if (options?.REPLACE) {
            parser.push('REPLACE');
        }
        if (options?.ABSTTL) {
            parser.push('ABSTTL');
        }
        if (options?.IDLETIME) {
            parser.push('IDLETIME', options.IDLETIME.toString());
        }
        if (options?.FREQ) {
            parser.push('FREQ', options.FREQ.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=RESTORE.js.map