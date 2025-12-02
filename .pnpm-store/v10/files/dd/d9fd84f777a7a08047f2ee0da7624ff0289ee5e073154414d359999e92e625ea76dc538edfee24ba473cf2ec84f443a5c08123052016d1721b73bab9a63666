"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes an item from a Cuckoo Filter if it exists
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param item - The item to remove from the filter
     */
    parseCommand(parser, key, item) {
        parser.push('CF.DEL');
        parser.pushKey(key);
        parser.push(item);
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=DEL.js.map