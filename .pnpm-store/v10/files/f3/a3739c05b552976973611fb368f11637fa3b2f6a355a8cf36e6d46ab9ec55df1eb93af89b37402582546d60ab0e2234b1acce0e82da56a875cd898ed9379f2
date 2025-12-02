/// <reference types="node" />
import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, Resp2Reply, MapReply, TuplesReply, TypeMapping, RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
import { TsMRangeGroupBy, TsMRangeGroupByRawMetadataReply3 } from './MRANGE_GROUPBY';
export type TsMRangeWithLabelsGroupByRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: ArrayReply<TuplesReply<[
        label: BlobStringReply,
        value: BlobStringReply
    ]>>,
    samples: ArrayReply<Resp2Reply<SampleRawReply>>
]>>;
export type TsMRangeWithLabelsGroupByRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: MapReply<BlobStringReply, BlobStringReply>,
    metadata: never,
    metadata2: TsMRangeGroupByRawMetadataReply3,
    samples: ArrayReply<SampleRawReply>
]>>;
export declare function createMRangeWithLabelsGroupByTransformArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions) => void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter with labels and grouping
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, groupBy: TsMRangeGroupBy, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: TsMRangeWithLabelsGroupByRawReply2, _?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            sources: string[] | Buffer[];
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: TsMRangeWithLabelsGroupByRawReply3) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            sources: ArrayReply<BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE_WITHLABELS_GROUPBY.d.ts.map