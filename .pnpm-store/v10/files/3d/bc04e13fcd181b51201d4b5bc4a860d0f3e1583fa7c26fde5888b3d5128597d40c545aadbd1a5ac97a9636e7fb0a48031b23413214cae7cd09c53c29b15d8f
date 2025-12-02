import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesReply, BlobStringReply, DoubleReply, UnwrapReply, TypeMapping } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns the member with the highest score in the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<TuplesReply<[] | [BlobStringReply, BlobStringReply]>>, preserve?: any, typeMapping?: TypeMapping) => {
            value: BlobStringReply<string>;
            score: DoubleReply<number>;
        } | null;
        readonly 3: (reply: UnwrapReply<TuplesReply<[] | [BlobStringReply, DoubleReply]>>) => {
            value: BlobStringReply<string>;
            score: DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=ZPOPMAX.d.ts.map