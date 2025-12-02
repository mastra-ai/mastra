"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Inserts one or more values into an array at the specified index.
     * Returns the new array length after insert, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param path - Path to the array in the JSON document
     * @param index - The position where to insert the values
     * @param json - The first value to insert
     * @param jsons - Additional values to insert
     */
    parseCommand(parser, key, path, index, json, ...jsons) {
        parser.push('JSON.ARRINSERT');
        parser.pushKey(key);
        parser.push(path, index.toString(), (0, generic_transformers_1.transformRedisJsonArgument)(json));
        for (let i = 0; i < jsons.length; i++) {
            parser.push((0, generic_transformers_1.transformRedisJsonArgument)(jsons[i]));
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ARRINSERT.js.map