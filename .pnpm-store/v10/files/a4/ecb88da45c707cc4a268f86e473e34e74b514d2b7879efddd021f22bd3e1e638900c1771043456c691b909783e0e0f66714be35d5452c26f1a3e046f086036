"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Constructs the OBJECT REFCOUNT command
     *
     * @param parser - The command parser
     * @param key - The key to get the reference count for
     * @see https://redis.io/commands/object-refcount/
     */
    parseCommand(parser, key) {
        parser.push('OBJECT', 'REFCOUNT');
        parser.pushKey(key);
    },
    transformReply: undefined
};
//# sourceMappingURL=OBJECT_REFCOUNT.js.map