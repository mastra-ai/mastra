"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the length of an array in a JSON document.
     * Returns null if the path does not exist or the value is not an array.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param options - Optional parameters
     * @param options.path - Path to the array in the JSON document
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.ARRLEN');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.push(options.path);
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ARRLEN.js.map