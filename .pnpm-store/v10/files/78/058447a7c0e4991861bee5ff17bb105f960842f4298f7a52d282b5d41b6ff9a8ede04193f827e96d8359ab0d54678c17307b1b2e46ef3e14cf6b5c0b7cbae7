"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Clears container values (arrays/objects) in a JSON document.
     * Returns the number of values cleared (0 or 1), or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the container to clear
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.CLEAR');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.push(options.path);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=CLEAR.js.map