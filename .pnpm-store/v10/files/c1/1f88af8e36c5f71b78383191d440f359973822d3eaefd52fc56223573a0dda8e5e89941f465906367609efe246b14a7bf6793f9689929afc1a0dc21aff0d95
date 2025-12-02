import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { FtSearchParams } from './SEARCH';
export interface FtExplainOptions {
    PARAMS?: FtSearchParams;
    DIALECT?: number;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the execution plan for a complex query.
     * @param parser - The command parser
     * @param index - Name of the index to explain query against
     * @param query - The query string to explain
     * @param options - Optional parameters:
     *   - PARAMS: Named parameters to use in the query
     *   - DIALECT: Version of query dialect to use (defaults to 1)
     */
    readonly parseCommand: (this: void, parser: CommandParser, index: RedisArgument, query: RedisArgument, options?: FtExplainOptions) => void;
    readonly transformReply: () => SimpleStringReply;
};
export default _default;
//# sourceMappingURL=EXPLAIN.d.ts.map