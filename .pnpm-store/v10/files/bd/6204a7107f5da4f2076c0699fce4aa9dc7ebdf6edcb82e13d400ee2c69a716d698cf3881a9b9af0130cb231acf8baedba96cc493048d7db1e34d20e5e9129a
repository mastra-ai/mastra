import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
/**
 * Options for the SORT command
 *
 * @property BY - Pattern for external key to sort by
 * @property LIMIT - Offset and count for results pagination
 * @property GET - Pattern(s) for retrieving external keys
 * @property DIRECTION - Sort direction: ASC (ascending) or DESC (descending)
 * @property ALPHA - Sort lexicographically instead of numerically
 */
export interface SortOptions {
    BY?: RedisArgument;
    LIMIT?: {
        offset: number;
        count: number;
    };
    GET?: RedisArgument | Array<RedisArgument>;
    DIRECTION?: 'ASC' | 'DESC';
    ALPHA?: boolean;
}
/**
 * Parses sort arguments for the SORT command
 *
 * @param parser - The command parser
 * @param key - The key to sort
 * @param options - Sort options
 */
export declare function parseSortArguments(parser: CommandParser, key: RedisArgument, options?: SortOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SORT command
     *
     * @param parser - The command parser
     * @param key - The key to sort (list, set, or sorted set)
     * @param options - Sort options
     * @see https://redis.io/commands/sort/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: SortOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=SORT.d.ts.map