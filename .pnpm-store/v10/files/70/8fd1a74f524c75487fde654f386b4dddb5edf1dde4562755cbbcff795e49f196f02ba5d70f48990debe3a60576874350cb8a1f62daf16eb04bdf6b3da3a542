"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    NOT_KEYED_COMMAND: true,
    IS_READ_ONLY: true,
    /**
     * Queries the index for time series matching a specific filter
     * @param parser - The command parser
     * @param filter - Filter to match time series labels
     */
    parseCommand(parser, filter) {
        parser.push('TS.QUERYINDEX');
        parser.pushVariadic(filter);
    },
    transformReply: {
        2: undefined,
        3: undefined
    }
};
//# sourceMappingURL=QUERYINDEX.js.map