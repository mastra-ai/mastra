import { NullReply, ArrayReply, BlobStringReply, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets completion suggestions with their payloads from a suggestion dictionary.
     * @param args - Same parameters as FT.SUGGET:
     *   - parser: The command parser
     *   - key: The suggestion dictionary key
     *   - prefix: The prefix to get completion suggestions for
     *   - options: Optional parameters for fuzzy matching and max results
     */
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, prefix: import("@redis/client/dist/lib/RESP/types").RedisArgument, options?: import("./SUGGET").FtSugGetOptions | undefined) => void;
    readonly transformReply: (this: void, reply: NullReply | UnwrapReply<ArrayReply<BlobStringReply>>) => {
        suggestion: BlobStringReply;
        payload: BlobStringReply;
    }[] | null;
};
export default _default;
//# sourceMappingURL=SUGGET_WITHPAYLOADS.d.ts.map