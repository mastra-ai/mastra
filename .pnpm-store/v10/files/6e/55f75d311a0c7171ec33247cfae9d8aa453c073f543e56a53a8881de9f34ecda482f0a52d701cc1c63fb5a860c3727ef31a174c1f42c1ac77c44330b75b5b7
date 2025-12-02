import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { BlobStringReply, ArrayReply, Resp2Reply, MapReply, TuplesReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
import { SampleRawReply } from './helpers';
import { RedisVariadicArgument } from '@redis/client/dist/lib/commands/generic-transformers';
export interface TsMGetOptions {
    LATEST?: boolean;
}
/**
 * Adds LATEST argument to command if specified
 * @param parser - The command parser
 * @param latest - Whether to include the LATEST argument
 */
export declare function parseLatestArgument(parser: CommandParser, latest?: boolean): void;
/**
 * Adds FILTER argument to command
 * @param parser - The command parser
 * @param filter - Filter to match time series keys
 */
export declare function parseFilterArgument(parser: CommandParser, filter: RedisVariadicArgument): void;
export type MGetRawReply2 = ArrayReply<TuplesReply<[
    key: BlobStringReply,
    labels: never,
    sample: Resp2Reply<SampleRawReply>
]>>;
export type MGetRawReply3 = MapReply<BlobStringReply, TuplesReply<[
    labels: never,
    sample: SampleRawReply
]>>;
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets the last samples matching a specific filter from multiple time series
     * @param parser - The command parser
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (this: void, parser: CommandParser, filter: RedisVariadicArgument, options?: TsMGetOptions) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: MGetRawReply2, _: any, typeMapping?: TypeMapping) => MapReply<BlobStringReply<string>, {
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            };
        }>;
        readonly 3: (this: void, reply: MGetRawReply3) => MapReply<BlobStringReply<string>, {
            sample: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            };
        }>;
    };
};
export default _default;
//# sourceMappingURL=MGET.d.ts.map