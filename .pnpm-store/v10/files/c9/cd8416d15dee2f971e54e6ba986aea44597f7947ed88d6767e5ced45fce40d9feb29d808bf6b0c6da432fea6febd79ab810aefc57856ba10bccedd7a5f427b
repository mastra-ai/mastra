import { CommandParser } from '../client/parser';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns members from one or more sorted sets in the specified order; blocks until elements are available
     * @param parser - The Redis command parser
     * @param timeout - Maximum seconds to block, 0 to block indefinitely
     * @param args - Additional arguments specifying the keys, min/max count, and order (MIN/MAX)
     */
    readonly parseCommand: (this: void, parser: CommandParser, timeout: number, keys: import("./generic-transformers").RedisVariadicArgument, side: import("./generic-transformers").SortedSetSide, options?: import("./ZMPOP").ZMPopOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("../RESP/types").UnwrapReply<import("../RESP/types").Resp2Reply<import("./ZMPOP").ZMPopRawReply>>, preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => {
            key: import("../RESP/types").BlobStringReply<string>;
            members: {
                value: import("../RESP/types").BlobStringReply<string>;
                score: import("../RESP/types").DoubleReply<number>;
            }[];
        } | null;
        readonly 3: (this: void, reply: import("../RESP/types").UnwrapReply<import("./ZMPOP").ZMPopRawReply>) => {
            key: import("../RESP/types").BlobStringReply<string>;
            members: {
                value: import("../RESP/types").BlobStringReply<string>;
                score: import("../RESP/types").DoubleReply<number>;
            }[];
        } | null;
    };
};
export default _default;
//# sourceMappingURL=BZMPOP.d.ts.map