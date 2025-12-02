"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Adds an item to a Cuckoo Filter only if it does not exist
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param item - The item to add to the filter if it doesn't exist
     */
    parseCommand(parser, key, item) {
        parser.push('CF.ADDNX');
        parser.pushKey(key);
        parser.push(item);
    },
    transformReply: generic_transformers_1.transformBooleanReply
};
//# sourceMappingURL=ADDNX.js.map