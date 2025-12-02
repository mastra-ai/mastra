declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Intersects multiple sorted sets and returns the result with scores.
     * @param args - Same parameters as ZINTER command.
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, keys: import("./ZINTER").ZInterKeysType, options?: import("./ZINTER").ZInterOptions | undefined) => void;
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
//# sourceMappingURL=ZINTER_WITHSCORES.d.ts.map