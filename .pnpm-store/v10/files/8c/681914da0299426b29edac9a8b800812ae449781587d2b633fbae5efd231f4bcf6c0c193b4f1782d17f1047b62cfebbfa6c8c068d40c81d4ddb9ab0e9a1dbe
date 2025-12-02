import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, Resp2Reply, MapReply, TuplesReply, TypeMapping, RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
export type TsMRangeWithLabelsRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: ArrayReply<TuplesReply<[
        label: BlobStringReply,
        value: BlobStringReply
    ]>>,
    samples: ArrayReply<Resp2Reply<SampleRawReply>>
]>>;
export type TsMRangeWithLabelsRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: MapReply<BlobStringReply, BlobStringReply>,
    metadata: never,
    samples: ArrayReply<SampleRawReply>
]>>;
/**
 * Creates a function that parses arguments for multi-range commands with labels
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
export declare function createTransformMRangeWithLabelsArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, options?: TsRangeOptions) => void;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter with labels
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: TsMRangeWithLabelsRawReply2, _?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            labels: Record<string, BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: TsMRangeWithLabelsRawReply3) => MapReply<BlobStringReply<string>, {
            labels: MapReply<BlobStringReply<string>, BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE_WITHLABELS.d.ts.map