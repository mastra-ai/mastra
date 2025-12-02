"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Increments a numeric value stored in a JSON document by a given number.
     * Returns the value after increment, or null if the key/path doesn't exist or value is not numeric.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to the numeric value
     * @param by - Amount to increment by
     */
    parseCommand(parser, key, path, by) {
        parser.push('JSON.NUMINCRBY');
        parser.pushKey(key);
        parser.push(path, by.toString());
    },
    transformReply: {
        2: (reply) => {
            return JSON.parse(reply.toString());
        },
        3: undefined
    }
};
//# sourceMappingURL=NUMINCRBY.js.map