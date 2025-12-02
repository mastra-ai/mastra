import { CommandParser } from '../client/parser';
import { NullReply, TuplesReply, BlobStringReply, DoubleReply, ArrayReply, UnwrapReply, Resp2Reply, TypeMapping } from '../RESP/types';
import { RedisVariadicArgument, SortedSetSide, Tail } from './generic-transformers';
export interface ZMPopOptions {
    COUNT?: number;
}
export type ZMPopRawReply = NullReply | TuplesReply<[
    key: BlobStringReply,
    members: ArrayReply<TuplesReply<[
        value: BlobStringReply,
        score: DoubleReply
    ]>>
]>;
export declare function parseZMPopArguments(parser: CommandParser, keys: RedisVariadicArgument, side: SortedSetSide, options?: ZMPopOptions): void;
export type ZMPopArguments = Tail<Parameters<typeof parseZMPopArguments>>;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns up to count members with the highest/lowest scores from the first non-empty sorted set.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets to pop from.
     * @param side - Side to pop from (MIN or MAX).
     * @param options - Optional parameters including COUNT.
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument, side: SortedSetSide, options?: ZMPopOptions) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: UnwrapReply<Resp2Reply<ZMPopRawReply>>, preserve?: any, typeMapping?: TypeMapping) => {
            key: BlobStringReply<string>;
            members: {
                value: BlobStringReply<string>;
                score: DoubleReply<number>;
            }[];
        } | null;
        readonly 3: (this: void, reply: UnwrapReply<ZMPopRawReply>) => {
            key: BlobStringReply<string>;
            members: {
                value: BlobStringReply<string>;
                score: DoubleReply<number>;
            }[];
        } | null;
    };
};
export default _default;
//# sourceMappingURL=ZMPOP.d.ts.map