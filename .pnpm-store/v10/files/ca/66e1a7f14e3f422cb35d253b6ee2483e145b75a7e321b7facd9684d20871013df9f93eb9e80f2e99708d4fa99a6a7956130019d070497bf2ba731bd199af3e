"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: true,
    /**
     * Retrieve the neighbors of a specified element in a vector set; the connections for each layer of the HNSW graph
     *
     * @param parser - The command parser
     * @param key - The key of the vector set
     * @param element - The name of the element to retrieve neighbors for
     * @see https://redis.io/commands/vlinks/
     */
    parseCommand(parser, key, element) {
        parser.push('VLINKS');
        parser.pushKey(key);
        parser.push(element);
    },
    transformReply: undefined
};
//# sourceMappingURL=VLINKS.js.map