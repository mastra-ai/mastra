declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the union of multiple sorted sets with their scores.
     * @param args - Same parameters as the ZUNION command.
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, keys: import("./generic-transformers").ZKeys, options?: import("./ZUNION").ZUnionOptions | undefined) => void;
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
//# sourceMappingURL=ZUNION_WITHSCORES.d.ts.map