"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Sets multiple JSON values in multiple documents.
     * Returns OK on success.
     *
     * @param parser - The Redis command parser
     * @param items - Array of objects containing key, path, and value to set
     * @param items[].key - The key containing the JSON document
     * @param items[].path - Path in the document to set
     * @param items[].value - JSON value to set at the path
     */
    parseCommand(parser, items) {
        parser.push('JSON.MSET');
        for (let i = 0; i < items.length; i++) {
            parser.pushKey(items[i].key);
            parser.push(items[i].path, (0, generic_transformers_1.transformRedisJsonArgument)(items[i].value));
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=MSET.js.map