import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns the member with the lowest score in the sorted set.
     * @param parser - The Redis command parser.
     * @param key - Key of the sorted set.
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument) => void;
    readonly transformReply: {
        readonly 2: (reply: import("../RESP/types").UnwrapReply<import("../RESP/types").TuplesReply<[] | [import("../RESP/types").BlobStringReply<string>, import("../RESP/types").BlobStringReply<string>]>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => {
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        } | null;
        readonly 3: (reply: import("../RESP/types").UnwrapReply<import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, import("../RESP/types").DoubleReply<number>] | []>>) => {
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=ZPOPMIN.d.ts.map