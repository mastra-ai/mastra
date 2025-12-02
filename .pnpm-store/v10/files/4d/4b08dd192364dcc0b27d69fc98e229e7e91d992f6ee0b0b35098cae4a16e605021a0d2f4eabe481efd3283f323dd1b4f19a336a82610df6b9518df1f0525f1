"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Gets values at a specific path from multiple JSON documents.
     * Returns an array of values at the path from each key, null for missing keys/paths.
     *
     * @param parser - The Redis command parser
     * @param keys - Array of keys containing JSON documents
     * @param path - Path to retrieve from each document
     */
    parseCommand(parser, keys, path) {
        parser.push('JSON.MGET');
        parser.pushKeys(keys);
        parser.push(path);
    },
    transformReply(reply) {
        return reply.map(json => (0, generic_transformers_1.transformRedisJsonNullReply)(json));
    }
};
//# sourceMappingURL=MGET.js.map