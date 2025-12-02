declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns all the elements in the sorted set with a score between min and max, with their scores.
     * @param args - Same parameters as the ZRANGEBYSCORE command.
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, min: string | number, max: string | number, options?: import("./ZRANGEBYSCORE").ZRangeByScoreOptions | undefined) => void;
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
//# sourceMappingURL=ZRANGEBYSCORE_WITHSCORES.d.ts.map