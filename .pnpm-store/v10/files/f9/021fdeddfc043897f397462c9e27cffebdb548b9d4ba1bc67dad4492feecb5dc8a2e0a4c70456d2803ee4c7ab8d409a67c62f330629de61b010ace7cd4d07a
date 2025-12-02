import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, BlobStringReply } from '../RESP/types';
export interface ZRangeByLexOptions {
    LIMIT?: {
        offset: number;
        count: number;
    };
}
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns all the elements in the sorted set at key with a lexicographical value between min and max.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param min - Minimum lexicographical value.
     * @param max - Maximum lexicographical value.
     * @param options - Optional parameters including LIMIT.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, min: RedisArgument, max: RedisArgument, options?: ZRangeByLexOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=ZRANGEBYLEX.d.ts.map