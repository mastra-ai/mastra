"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Constructs the XGROUP CREATE command to create a consumer group for a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - Name of the consumer group
     * @param id - ID of the last delivered item in the stream ('$' for last item, '0' for all items)
     * @param options - Additional options for group creation
     * @returns 'OK' if successful
     * @see https://redis.io/commands/xgroup-create/
     */
    parseCommand(parser, key, group, id, options) {
        parser.push('XGROUP', 'CREATE');
        parser.pushKey(key);
        parser.push(group, id);
        if (options?.MKSTREAM) {
            parser.push('MKSTREAM');
        }
        if (options?.ENTRIESREAD) {
            parser.push('ENTRIESREAD', options.ENTRIESREAD.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=XGROUP_CREATE.js.map