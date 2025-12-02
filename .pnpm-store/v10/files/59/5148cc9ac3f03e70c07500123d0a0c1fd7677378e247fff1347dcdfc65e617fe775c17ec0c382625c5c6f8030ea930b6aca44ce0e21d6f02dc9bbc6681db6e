"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseCfInsertArguments = void 0;
const generic_transformers_1 = require("@redis/client/dist/lib/commands/generic-transformers");
function parseCfInsertArguments(parser, key, items, options) {
    parser.pushKey(key);
    if (options?.CAPACITY !== undefined) {
        parser.push('CAPACITY', options.CAPACITY.toString());
    }
    if (options?.NOCREATE) {
        parser.push('NOCREATE');
    }
    parser.push('ITEMS');
    parser.pushVariadic(items);
}
exports.parseCfInsertArguments = parseCfInsertArguments;
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Adds one or more items to a Cuckoo Filter, creating it if it does not exist
     * @param parser - The command parser
     * @param key - The name of the Cuckoo filter
     * @param items - One or more items to add to the filter
     * @param options - Optional parameters for filter creation
     * @param options.CAPACITY - The number of entries intended to be added to the filter
     * @param options.NOCREATE - If true, prevents automatic filter creation
     */
    parseCommand(...args) {
        args[0].push('CF.INSERT');
        parseCfInsertArguments(...args);
    },
    transformReply: generic_transformers_1.transformBooleanArrayReply
};
//# sourceMappingURL=INSERT.js.map