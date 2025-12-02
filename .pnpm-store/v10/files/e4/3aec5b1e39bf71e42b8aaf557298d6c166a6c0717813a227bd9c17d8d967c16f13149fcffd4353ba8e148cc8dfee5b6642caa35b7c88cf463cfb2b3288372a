"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIME_SERIES_AGGREGATION_TYPE = void 0;
exports.TIME_SERIES_AGGREGATION_TYPE = {
    AVG: 'AVG',
    FIRST: 'FIRST',
    LAST: 'LAST',
    MIN: 'MIN',
    MAX: 'MAX',
    SUM: 'SUM',
    RANGE: 'RANGE',
    COUNT: 'COUNT',
    STD_P: 'STD.P',
    STD_S: 'STD.S',
    VAR_P: 'VAR.P',
    VAR_S: 'VAR.S',
    TWA: 'TWA'
};
exports.default = {
    IS_READ_ONLY: false,
    /**
     * Creates a compaction rule from source time series to destination time series
     * @param parser - The command parser
     * @param sourceKey - The source time series key
     * @param destinationKey - The destination time series key
     * @param aggregationType - The aggregation type to use
     * @param bucketDuration - The duration of each bucket in milliseconds
     * @param alignTimestamp - Optional timestamp for alignment
     */
    parseCommand(parser, sourceKey, destinationKey, aggregationType, bucketDuration, alignTimestamp) {
        parser.push('TS.CREATERULE');
        parser.pushKeys([sourceKey, destinationKey]);
        parser.push('AGGREGATION', aggregationType, bucketDuration.toString());
        if (alignTimestamp !== undefined) {
            parser.push(alignTimestamp.toString());
        }
    },
    transformReply: undefined
};
//# sourceMappingURL=CREATERULE.js.map