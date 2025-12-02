"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Checks if an item exists in a Cuckoo Filter
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param item - The item to check for existence
     */
    parseCommand(parser, key, item) {
        parser.push('CF.EXISTS');
        parser.pushKey(key);
        parser.push(item);
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=EXISTS.js.map