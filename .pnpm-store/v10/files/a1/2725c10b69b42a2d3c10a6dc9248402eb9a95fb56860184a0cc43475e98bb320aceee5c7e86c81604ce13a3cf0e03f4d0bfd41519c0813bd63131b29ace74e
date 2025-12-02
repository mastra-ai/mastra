"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the length of a string value stored in a JSON document.
     * Returns string length, array of lengths for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the string value
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.STRLEN');
        parser.pushKey(key);
        if (options?.path) {
            parser.push(options.path);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=STRLEN.js.map