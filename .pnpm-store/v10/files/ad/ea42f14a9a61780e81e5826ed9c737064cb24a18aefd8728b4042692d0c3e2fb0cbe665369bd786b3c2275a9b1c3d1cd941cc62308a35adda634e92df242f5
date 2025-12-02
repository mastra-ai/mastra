"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const helpers_1 = require("./helpers");
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Deletes samples between two timestamps from a time series
     * @param parser - The command parser
     * @param key - The key name of the time series
     * @param fromTimestamp - Start timestamp to delete from
     * @param toTimestamp - End timestamp to delete until
     */
    parseCommand(parser, key, fromTimestamp, toTimestamp) {
        parser.push('TS.DEL');
        parser.pushKey(key);
        parser.push((0, helpers_1.transformTimestampArgument)(fromTimestamp), (0, helpers_1.transformTimestampArgument)(toTimestamp));
    },
    transformReply: undefined
};
//# sourceMappingURL=DEL.js.map