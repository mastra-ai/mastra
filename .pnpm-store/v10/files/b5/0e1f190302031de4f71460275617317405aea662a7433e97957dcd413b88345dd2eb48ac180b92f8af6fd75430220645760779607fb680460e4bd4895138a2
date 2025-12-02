import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
export interface FtExplainCLIOptions {
    DIALECT?: number;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the execution plan for a complex query in a more verbose format than FT.EXPLAIN.
     * @param parser - The command parser
     * @param index - Name of the index to explain query against
     * @param query - The query string to explain
     * @param options - Optional parameters:
     *   - DIALECT: Version of query dialect to use (defaults to 1)
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, query: RedisArgument, options?: FtExplainCLIOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=EXPLAINCLI.d.ts.map