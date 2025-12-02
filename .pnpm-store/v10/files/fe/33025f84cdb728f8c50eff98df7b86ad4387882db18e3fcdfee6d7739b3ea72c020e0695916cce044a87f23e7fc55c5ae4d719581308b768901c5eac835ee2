import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, Resp2Reply, MapReply, TuplesReply, TypeMapping, RedisArgument, TuplesToMapReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
export declare const TIME_SERIES_REDUCERS: {
    readonly AVG: "AVG";
    readonly SUM: "SUM";
    readonly MIN: "MIN";
    readonly MAX: "MAX";
    readonly RANGE: "RANGE";
    readonly COUNT: "COUNT";
    readonly STD_P: "STD.P";
    readonly STD_S: "STD.S";
    readonly VAR_P: "VAR.P";
    readonly VAR_S: "VAR.S";
};
export type TimeSeriesReducer = typeof TIME_SERIES_REDUCERS[keyof typeof TIME_SERIES_REDUCERS];
export interface TsMRangeGroupBy {
    label: RedisArgument;
    REDUCE: TimeSeriesReducer;
}
/**
 * Adds GROUPBY arguments to command
 * @param parser - The command parser
 * @param groupBy - Group by parameters
 */
export declare function parseGroupByArguments(parser: CommandParser, groupBy: TsMRangeGroupBy): void;
export type TsMRangeGroupByRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: never,
    samples: ArrayReply<Resp2Reply<SampleRawReply>>
]>>;
export type TsMRangeGroupByRawMetadataReply3 = TuplesToMapReply<[
    [
        BlobStringReply<'sources'>,
        ArrayReply<BlobStringReply>
    ]
]>;
export type TsMRangeGroupByRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: never,
    metadata1: never,
    metadata2: TsMRangeGroupByRawMetadataReply3,
    samples: ArrayReply<SampleRawReply>
]>>;
/**
 * Creates a function that parses arguments for multi-range commands with grouping
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
export declare function createTransformMRangeGroupByArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions) => void;
/**
 * Extracts source keys from RESP3 metadata reply
 * @param raw - Raw metadata from RESP3 reply
 */
export declare function extractResp3MRangeSources(raw: TsMRangeGroupByRawMetadataReply3): ArrayReply<BlobStringReply<string>>;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter within a time range with grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: TsMRangeGroupByRawReply2, _?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: TsMRangeGroupByRawReply3) => MapReply<BlobStringReply<string>, {
            sources: ArrayReply<BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE_GROUPBY.d.ts.map