"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve the approximate vector associated with a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve the vector for
     * @see https://redis.io/commands/vemb/
     */
    parseCommand(parser, key, element) {
        parser.push('VEMB');
        parser.pushKey(key);
        parser.push(element);
    },
    transformReply: generic_transformers_1.transformDoubleArrayReply
};
//# sourceMappingURL=VEMB.js.map