import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, MapReply, TuplesReply, RedisArgument, NullReply } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
import { TsMRangeGroupBy, TsMRangeGroupByRawMetadataReply3 } from './MRANGE_GROUPBY';
export type TsMRangeWithLabelsGroupByRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: MapReply<BlobStringReply, BlobStringReply | NullReply>,
    metadata: never,
    metadata2: TsMRangeGroupByRawMetadataReply3,
    samples: ArrayReply<SampleRawReply>
]>>;
/**
 * Creates a function that parses arguments for multi-range commands with selected labels and grouping
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
export declare function createMRangeSelectedLabelsGroupByTransformArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, selectedLabels: RedisVariadicArgument, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions) => void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter with selected labels and grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param selectedLabels - Labels to include in the output
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, selectedLabels: RedisVariadicArgument, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, NullReply | BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: TsMRangeWithLabelsGroupByRawReply3) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, NullReply | BlobStringReply<string>>;
            sources: ArrayReply<BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE_SELECTED_LABELS_GROUPBY.d.ts.map