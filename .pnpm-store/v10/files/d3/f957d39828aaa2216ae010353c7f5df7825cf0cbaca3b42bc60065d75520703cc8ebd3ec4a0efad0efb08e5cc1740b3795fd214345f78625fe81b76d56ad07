"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Deletes a compaction rule between source and destination time series
     * @param parser - The command parser
     * @param sourceKey - The source time series key
     * @param destinationKey - The destination time series key
     */
    parseCommand(parser, sourceKey, destinationKey) {
        parser.push('TS.DELETERULE');
        parser.pushKeys([sourceKey, destinationKey]);
    },
    transformReply: undefined
};
//# sourceMappingURL=DELETERULE.js.map