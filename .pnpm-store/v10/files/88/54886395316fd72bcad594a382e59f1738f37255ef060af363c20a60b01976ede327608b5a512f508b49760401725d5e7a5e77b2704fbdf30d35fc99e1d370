"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: false,
    /**
     * Swaps the data of two Redis databases.
     * @param parser - The Redis command parser.
     * @param index1 - First database index.
     * @param index2 - Second database index.
     */
    parseCommand(parser, index1, index2) {
        parser.push('SWAPDB', index1.toString(), index2.toString());
    },
    transformReply: undefined
};
//# sourceMappingURL=SWAPDB.js.map