import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, Resp2Reply, MapReply, TuplesReply, TypeMapping, NullReply, RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
export type TsMRangeSelectedLabelsRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: ArrayReply<TuplesReply<[
        label: BlobStringReply,
        value: BlobStringReply | NullReply
    ]>>,
    samples: ArrayReply<Resp2Reply<SampleRawReply>>
]>>;
export type TsMRangeSelectedLabelsRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: MapReply<BlobStringReply, BlobStringReply | NullReply>,
    metadata: never,
    samples: ArrayReply<SampleRawReply>
]>>;
/**
 * Creates a function that parses arguments for multi-range commands with selected labels
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
export declare function createTransformMRangeSelectedLabelsArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, selectedLabels: RedisVariadicArgument, filter: RedisVariadicArgument, options?: TsRangeOptions) => void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter with selected labels
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param selectedLabels - Labels to include in the output
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, selectedLabels: RedisVariadicArgument, filter: RedisVariadicArgument, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, NullReply | BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: TsMRangeSelectedLabelsRawReply3) => MapReply<BlobStringReply<string>, {
            labels: never;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE_SELECTED_LABELS.d.ts.map