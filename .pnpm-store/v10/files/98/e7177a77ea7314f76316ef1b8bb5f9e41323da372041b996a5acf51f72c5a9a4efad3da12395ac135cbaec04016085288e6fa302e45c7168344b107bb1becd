import { NullReply, ArrayReply, BlobStringReply, DoubleReply, UnwrapReply, TypeMapping } from '@redis/client/dist/lib/RESP/types';
type SuggestScoreWithPayload = {
    suggestion: BlobStringReply;
    score: DoubleReply;
    payload: BlobStringReply;
};
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets completion suggestions with their scores and payloads from a suggestion dictionary.
     * @param args - Same parameters as FT.SUGGET:
     *   - parser: The command parser
     *   - key: The suggestion dictionary key
     *   - prefix: The prefix to get completion suggestions for
     *   - options: Optional parameters for fuzzy matching and max results
     */
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, prefix: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (reply: NullReply | UnwrapReply<ArrayReply<BlobStringReply>>, preserve?: any, typeMapping?: TypeMapping) => SuggestScoreWithPayload[] | null;
        readonly 3: (reply: NullReply | UnwrapReply<ArrayReply<BlobStringReply | DoubleReply>>) => SuggestScoreWithPayload[] | null;
    };
};
export default _default;
//# sourceMappingURL=SUGGET_WITHSCORES_WITHPAYLOADS.d.ts.map