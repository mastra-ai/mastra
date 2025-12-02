import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
export interface ZRangeOptions {
    BY?: 'SCORE' | 'LEX';
    REV?: boolean;
    LIMIT?: {
        offset: number;
        count: number;
    };
}
export declare function zRangeArgument(min: RedisArgument | number, max: RedisArgument | number, options?: ZRangeOptions): RedisArgument[];
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the specified range of elements in the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum index, score or lexicographical value.
     * @param max - Maximum index, score or lexicographical value.
     * @param options - Optional parameters for range retrieval (BY, REV, LIMIT).
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, min: RedisArgument | number, max: RedisArgument | number, options?: ZRangeOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=ZRANGE.d.ts.map