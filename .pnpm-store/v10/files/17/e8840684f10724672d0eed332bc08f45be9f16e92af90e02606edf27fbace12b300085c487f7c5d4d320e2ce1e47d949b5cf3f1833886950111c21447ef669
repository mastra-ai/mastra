import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { NullReply, ArrayReply, BlobStringReply, RedisArgument } from '@redis/client/dist/lib/RESP/types';
export interface FtSugGetOptions {
    FUZZY?: boolean;
    MAX?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets completion suggestions for a prefix from a suggestion dictionary.
     * @param parser - The command parser
     * @param key - The suggestion dictionary key
     * @param prefix - The prefix to get completion suggestions for
     * @param options - Optional parameters:
     *   - FUZZY: Enable fuzzy prefix matching
     *   - MAX: Maximum number of results to return
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, prefix: RedisArgument, options?: FtSugGetOptions) => void;
    readonly transformReply: () => NullReply | ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=SUGGET.d.ts.map