import { CommandParser } from '../client/parser';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the difference between the first sorted set and all successive sorted sets with their scores.
     * @param parser - The Redis command parser.
     * @param keys - Keys of the sorted sets.
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument) => void;
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
//# sourceMappingURL=ZDIFF_WITHSCORES.d.ts.map