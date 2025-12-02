import { CommandParser } from '../client/parser';
import { NullReply, TuplesReply, BlobStringReply, DoubleReply, UnwrapReply, TypeMapping } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns the member with the highest score in a sorted set, or blocks until one is available
     * @param parser - The Redis command parser
     * @param keys - Key of the sorted set, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument, timeout: number) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: UnwrapReply<NullReply | TuplesReply<[BlobStringReply, BlobStringReply, BlobStringReply]>>, preserve?: any, typeMapping?: TypeMapping) => {
            key: BlobStringReply<string>;
            value: BlobStringReply<string>;
            score: DoubleReply<number>;
        } | null;
        readonly 3: (this: void, reply: UnwrapReply<NullReply | TuplesReply<[BlobStringReply, BlobStringReply, DoubleReply]>>) => {
            key: BlobStringReply<string>;
            value: BlobStringReply<string>;
            score: DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=BZPOPMAX.d.ts.map