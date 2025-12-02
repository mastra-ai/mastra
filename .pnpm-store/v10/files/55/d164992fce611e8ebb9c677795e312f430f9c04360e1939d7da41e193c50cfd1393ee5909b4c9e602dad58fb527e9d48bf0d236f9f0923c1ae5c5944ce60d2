"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Appends a string to a string value stored in a JSON document.
     * Returns new string length after append, or null if the path doesn't exist or value is not a string.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param append - String to append
     * @param options - Optional parameters
     * @param options.path - Path to the string value
     */
    parseCommand(parser, key, append, options) {
        parser.push('JSON.STRAPPEND');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.push(options.path);
        }
        parser.push((0, generic_transformers_1.transformRedisJsonArgument)(append));
    },
    transformReply: undefined
};
//# sourceMappingURL=STRAPPEND.js.map