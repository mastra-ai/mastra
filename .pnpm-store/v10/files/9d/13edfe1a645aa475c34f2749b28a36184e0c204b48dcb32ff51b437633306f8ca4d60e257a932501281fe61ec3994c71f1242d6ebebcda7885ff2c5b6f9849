import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
import { SortedSetMember } from './generic-transformers';
/**
 * Options for the ZADD INCR command
 *
 * @property condition - Add condition: NX (only if not exists) or XX (only if exists)
 * @property comparison - Score comparison: LT (less than) or GT (greater than)
 * @property CH - Return the number of changed elements instead of added elements
 */
export interface ZAddOptions {
    condition?: 'NX' | 'XX';
    comparison?: 'LT' | 'GT';
    CH?: boolean;
}
/**
 * Command for incrementing the score of a member in a sorted set
 */
declare const _default: {
    /**
     * Constructs the ZADD command with INCR option to increment the score of a member
     *
     * @param parser - The command parser
     * @param key - The sorted set key
     * @param members - Member(s) whose score to increment
     * @param options - Additional options for the increment operation
     * @returns The new score of the member after increment (null if member does not exist with XX option)
     * @see https://redis.io/commands/zadd/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, members: SortedSetMember | Array<SortedSetMember>, options?: ZAddOptions) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").NullReply | import("../RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("../RESP/types").DoubleReply<number> | null;
        3: () => import("../RESP/types").NullReply | import("../RESP/types").DoubleReply<number>;
    };
};
export default _default;
//# sourceMappingURL=ZADD_INCR.d.ts.map