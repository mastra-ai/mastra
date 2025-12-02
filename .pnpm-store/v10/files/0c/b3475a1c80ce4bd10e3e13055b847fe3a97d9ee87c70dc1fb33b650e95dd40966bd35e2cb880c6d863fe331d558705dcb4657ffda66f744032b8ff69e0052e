import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
import { SortedSetMember } from './generic-transformers';
/**
 * Options for the ZADD command
 */
export interface ZAddOptions {
    condition?: 'NX' | 'XX';
    /**
     * @deprecated Use `{ condition: 'NX' }` instead.
     */
    NX?: boolean;
    /**
     * @deprecated Use `{ condition: 'XX' }` instead.
     */
    XX?: boolean;
    comparison?: 'LT' | 'GT';
    /**
     * @deprecated Use `{ comparison: 'LT' }` instead.
     */
    LT?: boolean;
    /**
     * @deprecated Use `{ comparison: 'GT' }` instead.
     */
    GT?: boolean;
    CH?: boolean;
}
/**
 * Command for adding members to a sorted set
 */
declare const _default: {
    /**
     * Constructs the ZADD command to add one or more members to a sorted set
     *
     * @param parser - The command parser
     * @param key - The sorted set key
     * @param members - One or more members to add with their scores
     * @param options - Additional options for adding members
     * @returns Number of new members added (or changed members if CH is set)
     * @see https://redis.io/commands/zadd/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, members: SortedSetMember | Array<SortedSetMember>, options?: ZAddOptions) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("../RESP/types").DoubleReply<number>;
        3: () => import("../RESP/types").DoubleReply<number>;
    };
};
export default _default;
/**
 * Helper function to push sorted set members to the command
 *
 * @param parser - The command parser
 * @param members - One or more members with their scores
 */
export declare function pushMembers(parser: CommandParser, members: SortedSetMember | Array<SortedSetMember>): void;
//# sourceMappingURL=ZADD.d.ts.map