"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Deletes a value from a JSON document.
     * Returns the number of paths deleted (0 or 1), or null if the key does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the value to delete
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.DEL');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.push(options.path);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=DEL.js.map