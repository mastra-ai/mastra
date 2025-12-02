"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes and returns an element from an array in a JSON document.
     * Returns null if the path does not exist or the value is not an array.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param options - Optional parameters
     * @param options.path - Path to the array in the JSON document
     * @param options.index - Optional index to pop from. Default is -1 (last element)
     */
    parseCommand(parser, key, options) {
        parser.push('JSON.ARRPOP');
        parser.pushKey(key);
        if (options) {
            parser.push(options.path);
            if (options.index !== undefined) {
                parser.push(options.index.toString());
            }
        }
    },
    transformReply(reply) {
        return (0, generic_transformers_1.isArrayReply)(reply) ?
            reply.map(item => (0, generic_transformers_1.transformRedisJsonNullReply)(item)) :
            (0, generic_transformers_1.transformRedisJsonNullReply)(reply);
    }
};
//# sourceMappingURL=ARRPOP.js.map