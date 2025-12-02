"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Adds an alias to a RediSearch index.
     * @param parser - The command parser
     * @param alias - The alias to add
     * @param index - The index name to alias
     */
    parseCommand(parser, alias, index) {
        parser.push('FT.ALIASADD', alias, index);
    },
    transformReply: undefined
};
//# sourceMappingURL=ALIASADD.js.map