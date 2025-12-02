import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the score of a member in a sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param member - Member to get the score for.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, member: RedisArgument) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").NullReply | import("../RESP/types").BlobStringReply<string>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("../RESP/types").DoubleReply<number> | null;
        3: () => import("../RESP/types").NullReply | import("../RESP/types").DoubleReply<number>;
    };
};
export default _default;
//# sourceMappingURL=ZSCORE.d.ts.map