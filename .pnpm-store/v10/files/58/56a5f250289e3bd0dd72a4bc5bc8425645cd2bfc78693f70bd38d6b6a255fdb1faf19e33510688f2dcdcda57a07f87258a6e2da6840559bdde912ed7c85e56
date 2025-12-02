"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Merges a given JSON value into a JSON document.
     * Returns OK on success, or null if the key does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to merge into
     * @param value - JSON value to merge
     */
    parseCommand(parser, key, path, value) {
        parser.push('JSON.MERGE');
        parser.pushKey(key);
        parser.push(path, (0, generic_transformers_1.transformRedisJsonArgument)(value));
    },
    transformReply: undefined
};
//# sourceMappingURL=MERGE.js.map