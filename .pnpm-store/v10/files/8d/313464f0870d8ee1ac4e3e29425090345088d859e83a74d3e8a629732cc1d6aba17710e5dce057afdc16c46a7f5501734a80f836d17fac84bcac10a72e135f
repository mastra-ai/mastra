"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Returns the index of the first occurrence of a value in a JSON array.
     * If the specified value is not found, it returns -1, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param path - Path to the array in the JSON document
     * @param json - The value to search for
     * @param options - Optional range parameters for the search
     * @param options.range.start - Starting index for the search
     * @param options.range.stop - Optional ending index for the search
     */
    parseCommand(parser, key, path, json, options) {
        parser.push('JSON.ARRINDEX');
        parser.pushKey(key);
        parser.push(path, (0, generic_transformers_1.transformRedisJsonArgument)(json));
        if (options?.range) {
            parser.push(options.range.start.toString());
            if (options.range.stop !== undefined) {
                parser.push(options.range.stop.toString());
            }
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ARRINDEX.js.map