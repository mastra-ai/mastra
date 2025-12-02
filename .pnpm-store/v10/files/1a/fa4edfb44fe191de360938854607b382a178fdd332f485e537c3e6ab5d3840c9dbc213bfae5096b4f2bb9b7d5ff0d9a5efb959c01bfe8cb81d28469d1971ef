"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    /**
     * Remove an element from a vector set
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to remove from the vector set
     * @see https://redis.io/commands/vrem/
     */
    parseCommand(parser, key, element) {
        parser.push('VREM');
        parser.pushKey(key);
        parser.push(element);
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=VREM.js.map