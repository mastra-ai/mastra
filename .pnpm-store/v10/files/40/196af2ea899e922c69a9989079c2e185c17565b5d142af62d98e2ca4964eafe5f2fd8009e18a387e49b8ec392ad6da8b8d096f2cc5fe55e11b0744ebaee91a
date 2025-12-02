/**
 * Returns value estimates for one or more ranks in a t-digest sketch, starting from highest rank
 * @param parser - The command parser
 * @param key - The name of the t-digest sketch
 * @param ranks - Array of ranks to get value estimates for (descending order)
 */
declare const _default: {
    readonly IS_READ_ONLY: true;
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, ranks: number[]) => void;
    readonly transformReply: {
        2: (reply: import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>[], preserve?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").DoubleReply<number>[];
        3: () => import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").DoubleReply<number>>;
    };
};
export default _default;
//# sourceMappingURL=BYREVRANK.d.ts.map