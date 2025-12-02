"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve the attributes of a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve attributes for
     * @see https://redis.io/commands/vgetattr/
     */
    parseCommand(parser, key, element) {
        parser.push('VGETATTR');
        parser.pushKey(key);
        parser.push(element);
    },
    transformReply: generic_transformers_1.transformRedisJsonNullReply
};
//# sourceMappingURL=VGETATTR.js.map