"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Gets values from a JSON document.
     * Returns the value at the specified path, or null if the key or path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path(s) to the value(s) to retrieve
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.GET');
        parser.pushKey(key);
        if (options?.path !== undefined) {
            parser.pushVariadic(options.path);
        }
    },
    transformReply: generic_transformers_1.transformRedisJsonNullReply
};
//# sourceMappingURL=GET.js.map