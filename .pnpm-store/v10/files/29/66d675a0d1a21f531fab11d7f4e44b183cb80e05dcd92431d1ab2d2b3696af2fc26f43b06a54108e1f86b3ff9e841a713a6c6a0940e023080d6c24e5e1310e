declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the specified range of elements in the sorted set with their scores.
     * @param args - Same parameters as the ZRANGE command.
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, min: number | import("../RESP/types").RedisArgument, max: number | import("../RESP/types").RedisArgument, options?: import("./ZRANGE").ZRangeOptions | undefined) => void;
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
//# sourceMappingURL=ZRANGE_WITHSCORES.d.ts.map