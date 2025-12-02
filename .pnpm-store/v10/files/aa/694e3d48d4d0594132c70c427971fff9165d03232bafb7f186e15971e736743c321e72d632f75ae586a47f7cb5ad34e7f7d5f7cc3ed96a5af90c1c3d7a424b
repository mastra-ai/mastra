import { NullReply, TuplesReply, NumberReply, BlobStringReply, DoubleReply, UnwrapReply } from '../RESP/types';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the rank of a member in the sorted set with its score.
     * @param args - Same parameters as the ZRANK command.
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, member: import("../RESP/types").RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: UnwrapReply<NullReply | TuplesReply<[NumberReply, BlobStringReply]>>) => {
            rank: NumberReply<number>;
            score: number;
        } | null;
        readonly 3: (reply: UnwrapReply<NullReply | TuplesReply<[BlobStringReply, DoubleReply]>>) => {
            rank: BlobStringReply<string>;
            score: DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=ZRANK_WITHSCORE.d.ts.map