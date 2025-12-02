import { CommandParser } from '../client/parser';
import { RedisVariadicArgument } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns the member with the lowest score in a sorted set, or blocks until one is available
     * @param parser - The Redis command parser
     * @param keys - Key of the sorted set, or array of keys to try sequentially
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: RedisVariadicArgument, timeout: number) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("../RESP/types").UnwrapReply<import("../RESP/types").NullReply | import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, import("../RESP/types").BlobStringReply<string>, import("../RESP/types").BlobStringReply<string>]>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => {
            key: import("../RESP/types").BlobStringReply<string>;
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        } | null;
        readonly 3: (this: void, reply: import("../RESP/types").UnwrapReply<import("../RESP/types").NullReply | import("../RESP/types").TuplesReply<[import("../RESP/types").BlobStringReply<string>, import("../RESP/types").BlobStringReply<string>, import("../RESP/types").DoubleReply<number>]>>) => {
            key: import("../RESP/types").BlobStringReply<string>;
            value: import("../RESP/types").BlobStringReply<string>;
            score: import("../RESP/types").DoubleReply<number>;
        } | null;
    };
};
export default _default;
//# sourceMappingURL=BZPOPMIN.d.ts.map