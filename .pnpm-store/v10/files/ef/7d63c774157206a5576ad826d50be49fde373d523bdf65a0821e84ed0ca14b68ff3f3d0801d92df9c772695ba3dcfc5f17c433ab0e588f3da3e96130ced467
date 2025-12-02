"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XGROUP SETID command to set the last delivered ID for a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param id - ID to set as last delivered message ('$' for last item, '0' for all items)
     * @param options - Additional options for setting the group ID
     * @returns 'OK' if successful
     * @see https://redis.io/commands/xgroup-setid/
     */
    parseCommand(parser, key, group, id, options) {
        parser.push('XGROUP', 'SETID');
        parser.pushKey(key);
        parser.push(group, id);
        if (options?.ENTRIESREAD) {
            parser.push('ENTRIESREAD', options.ENTRIESREAD.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=XGROUP_SETID.js.map