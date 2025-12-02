"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the TOUCH command to alter the last access time of keys
     *
     * @param parser - The command parser
     * @param key - One or more keys to touch
     * @returns The number of keys that were touched
     * @see https://redis.io/commands/touch/
     */
    parseCommand(parser, key) {
        parser.push('TOUCH');
        parser.pushKeys(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=TOUCH.js.map