"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("./generic-transformers");
exports.default = {
    /**
     * Set or replace attributes on a vector set element
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to set attributes for
     * @param attributes - The attributes to set (as JSON string or object)
     * @see https://redis.io/commands/vsetattr/
     */
    parseCommand(parser, key, element, attributes) {
        parser.push('VSETATTR');
        parser.pushKey(key);
        parser.push(element);
        if (typeof attributes === 'object' && attributes !== null) {
            parser.push(JSON.stringify(attributes));
        }
        else {
            parser.push(attributes);
        }
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=VSETATTR.js.map