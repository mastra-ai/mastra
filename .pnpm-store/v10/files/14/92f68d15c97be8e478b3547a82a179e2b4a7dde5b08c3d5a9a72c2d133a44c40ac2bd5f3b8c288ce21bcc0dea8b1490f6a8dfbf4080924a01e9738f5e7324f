import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { ArrayReply, BlobStringReply, Resp2Reply, MapReply, TuplesReply, TypeMapping, RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
import { SampleRawReply, Timestamp } from './helpers';
import { TsRangeOptions } from './RANGE';
export type TsMRangeRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: never,
    samples: ArrayReply<Resp2Reply<SampleRawReply>>
]>>;
export type TsMRangeRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: never,
    metadata: never,
    samples: ArrayReply<SampleRawReply>
]>>;
/**
 * Creates a function that parses arguments for multi-range commands
 * @param command - The command name to use (TS.MRANGE or TS.MREVRANGE)
 */
export declare function createTransformMRangeArguments(command: RedisArgument): (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, options?: TsRangeOptions) => void;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a specific filter within a time range
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: CommandParser, fromTimestamp: Timestamp, toTimestamp: Timestamp, filter: RedisVariadicArgument, options?: TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: TsMRangeRawReply2, _?: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: number;
        }[]>;
        readonly 3: (this: void, reply: TsMRangeRawReply3) => MapReply<BlobStringReply<string>, {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        }[]>;
    };
};
export default _default;
//# sourceMappingURL=MRANGE.d.ts.map