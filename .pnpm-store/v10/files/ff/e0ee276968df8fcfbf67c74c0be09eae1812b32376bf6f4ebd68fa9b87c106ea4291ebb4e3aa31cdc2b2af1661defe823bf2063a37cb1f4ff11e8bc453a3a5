import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
export declare const TIME_SERIES_AGGREGATION_TYPE: {
    readonly AVG: "AVG";
    readonly FIRST: "FIRST";
    readonly LAST: "LAST";
    readonly MIN: "MIN";
    readonly MAX: "MAX";
    readonly SUM: "SUM";
    readonly RANGE: "RANGE";
    readonly COUNT: "COUNT";
    readonly STD_P: "STD.P";
    readonly STD_S: "STD.S";
    readonly VAR_P: "VAR.P";
    readonly VAR_S: "VAR.S";
    readonly TWA: "TWA";
};
export type TimeSeriesAggregationType = typeof TIME_SERIES_AGGREGATION_TYPE[keyof typeof TIME_SERIES_AGGREGATION_TYPE];
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Creates a compaction rule from source time series to destination time series
     * @param parser - The command parser
     * @param sourceKey - The source time series key
     * @param destinationKey - The destination time series key
     * @param aggregationType - The aggregation type to use
     * @param bucketDuration - The duration of each bucket in milliseconds
     * @param alignTimestamp - Optional timestamp for alignment
     */
    readonly parseCommand: (this: void, parser: CommandParser, sourceKey: RedisArgument, destinationKey: RedisArgument, aggregationType: TimeSeriesAggregationType, bucketDuration: number, alignTimestamp?: number) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=CREATERULE.d.ts.map