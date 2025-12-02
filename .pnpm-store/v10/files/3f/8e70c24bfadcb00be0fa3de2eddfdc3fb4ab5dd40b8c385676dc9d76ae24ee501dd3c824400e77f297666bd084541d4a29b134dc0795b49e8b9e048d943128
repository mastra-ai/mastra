import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns one or more random members with their scores from a sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     * @param count - Number of members to return.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, count: number) => void;
    readonly transformReply: {
        2: (reply: import("../RESP/types").ArrayReply<import("../RESP/types").BlobStringReply<string>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => {
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        }[];
        3: (reply: import("../RESP/types").ArrayReply<import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, import("../RESP/types").DoubleReply<number>]>>) => {
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        }[];
    };
};
export default _default;
//# sourceMappingURL=ZRANDMEMBER_COUNT_WITHSCORES.d.ts.map