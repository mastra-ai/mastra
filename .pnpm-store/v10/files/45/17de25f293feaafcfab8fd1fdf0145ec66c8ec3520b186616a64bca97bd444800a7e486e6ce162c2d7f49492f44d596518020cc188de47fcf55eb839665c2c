"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the type of JSON value at a specific path in a JSON document.
     * Returns the type as a string, array of types for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to examine
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.TYPE');
        parser.pushKey(key);
        if (options?.path) {
            parser.push(options.path);
        }
    },
    transformReply: {
        2: undefined,
        // TODO: RESP3 wraps the response in another array, but only returns 1 
        3: (reply) => {
            return reply[0];
        }
    },
};
//# sourceMappingURL=TYPE.js.map