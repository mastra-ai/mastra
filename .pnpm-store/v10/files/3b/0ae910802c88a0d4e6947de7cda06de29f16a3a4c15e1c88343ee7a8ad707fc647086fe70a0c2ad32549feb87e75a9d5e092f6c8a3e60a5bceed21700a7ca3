import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    /**
     * Increments the score of a member in a sorted set by the specified increment.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param increment - Value to increment the score by.
     * @param member - Member whose score should be incremented.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, increment: number, member: RedisArgument) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("../RESP/types").DoubleReply<number>;
        3: () => import("../RESP/types").DoubleReply<number>;
    };
};
export default _default;
//# sourceMappingURL=ZINCRBY.d.ts.map