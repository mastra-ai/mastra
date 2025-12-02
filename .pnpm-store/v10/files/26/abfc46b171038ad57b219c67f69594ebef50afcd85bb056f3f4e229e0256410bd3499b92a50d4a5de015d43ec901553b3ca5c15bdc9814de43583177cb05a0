"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Removes the specified keys. A key is ignored if it does not exist
     * @param parser - The Redis command parser
     * @param keys - One or more keys to delete
     */
    parseCommand(parser, keys) {
        parser.push('DEL');
        parser.pushKeys(keys);
    },
    transformReply: undefined
};
//# sourceMappingURL=DEL.js.map