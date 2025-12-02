"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Asynchronously saves the dataset to disk
     * @param parser - The Redis command parser
     * @param options - Optional configuration
     * @param options.SCHEDULE - Schedule a BGSAVE operation when no BGSAVE is already in progress
     */
    parseCommand(parser, options) {
        parser.push('BGSAVE');
        if (options?.SCHEDULE) {
            parser.push('SCHEDULE');
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=BGSAVE.js.map