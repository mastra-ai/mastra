"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Sets a JSON value at a specific path in a JSON document.
     * Returns OK on success, or null if condition (NX/XX) is not met.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path in the document to set
     * @param json - JSON value to set at the path
     * @param options - Optional parameters
     * @param options.condition - Set condition: NX (only if doesn't exist) or XX (only if exists)
     * @deprecated options.NX - Use options.condition instead
     * @deprecated options.XX - Use options.condition instead
     */
    parseCommand(parser, key, path, json, options) {
        parser.push('JSON.SET');
        parser.pushKey(key);
        parser.push(path, (0, generic_transformers_1.transformRedisJsonArgument)(json));
        if (options?.condition) {
            parser.push(options?.condition);
        }
        else if (options?.NX) {
            parser.push('NX');
        }
        else if (options?.XX) {
            parser.push('XX');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=SET.js.map