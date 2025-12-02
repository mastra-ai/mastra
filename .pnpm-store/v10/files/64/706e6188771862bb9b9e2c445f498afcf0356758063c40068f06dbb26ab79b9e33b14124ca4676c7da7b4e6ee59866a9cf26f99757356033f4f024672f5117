import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
export interface ZRangeStoreOptions {
    BY?: 'SCORE' | 'LEX';
    REV?: true;
    LIMIT?: {
        offset: number;
        count: number;
    };
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Stores the result of a range operation on a sorted set into a new sorted set.
     * @param parser - The Redis command parser.
     * @param destination - Destination key where the result will be stored.
     * @param source - Key of the source sorted set.
     * @param min - Minimum index, score or lexicographical value.
     * @param max - Maximum index, score or lexicographical value.
     * @param options - Optional parameters for the range operation (BY, REV, LIMIT).
     */
    readonly parseCommand: (this: void, parser: CommandParser, destination: RedisArgument, source: RedisArgument, min: RedisArgument | number, max: RedisArgument | number, options?: ZRangeStoreOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=ZRANGESTORE.d.ts.map