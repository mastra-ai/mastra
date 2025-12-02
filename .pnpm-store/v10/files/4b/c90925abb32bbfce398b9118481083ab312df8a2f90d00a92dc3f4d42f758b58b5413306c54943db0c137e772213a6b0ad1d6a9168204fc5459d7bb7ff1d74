"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Updates a synonym group with new terms.
     * @param parser - The command parser
     * @param index - Name of the index that contains the synonym group
     * @param groupId - ID of the synonym group to update
     * @param terms - One or more synonym terms to add to the group
     * @param options - Optional parameters:
     *   - SKIPINITIALSCAN: Skip the initial scan for existing documents
     */
    parseCommand(parser, index, groupId, terms, options) {
        parser.push('FT.SYNUPDATE', index, groupId);
        if (options?.SKIPINITIALSCAN) {
            parser.push('SKIPINITIALSCAN');
        }
        parser.pushVariadic(terms);
    },
    transformReply: undefined
};
//# sourceMappingURL=SYNUPDATE.js.map