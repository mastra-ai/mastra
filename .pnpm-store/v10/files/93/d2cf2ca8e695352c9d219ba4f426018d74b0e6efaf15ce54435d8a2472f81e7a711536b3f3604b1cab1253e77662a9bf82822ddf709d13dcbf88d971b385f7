"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Appends one or more values to the end of an array in a JSON document.
     * Returns the new array length after append, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key to append to
     * @param path - Path to the array in the JSON document
     * @param json - The first value to append
     * @param jsons - Additional values to append
     */
    parseCommand(parser, key, path, json, ...jsons) {
        parser.push('JSON.ARRAPPEND');
        parser.pushKey(key);
        parser.push(path, (0, generic_transformers_1.transformRedisJsonArgument)(json));
        for (let i = 0; i < jsons.length; i++) {
            parser.push((0, generic_transformers_1.transformRedisJsonArgument)(jsons[i]));
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=ARRAPPEND.js.map