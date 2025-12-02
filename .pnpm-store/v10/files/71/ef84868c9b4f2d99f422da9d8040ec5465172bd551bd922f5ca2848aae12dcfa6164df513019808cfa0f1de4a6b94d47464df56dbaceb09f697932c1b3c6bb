"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the UNLINK command to asynchronously delete one or more keys
     *
     * @param parser - The command parser
     * @param keys - One or more keys to unlink
     * @returns The number of keys that were unlinked
     * @see https://redis.io/commands/unlink/
     */
    parseCommand(parser, keys) {
        parser.push('UNLINK');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=UNLINK.js.map