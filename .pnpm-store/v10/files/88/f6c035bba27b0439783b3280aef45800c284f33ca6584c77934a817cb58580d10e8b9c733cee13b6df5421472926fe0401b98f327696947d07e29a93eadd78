"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the number of keys in the object stored in a JSON document.
     * Returns length of object, array of lengths for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the object to examine
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.OBJLEN');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.push(options.path);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=OBJLEN.js.map