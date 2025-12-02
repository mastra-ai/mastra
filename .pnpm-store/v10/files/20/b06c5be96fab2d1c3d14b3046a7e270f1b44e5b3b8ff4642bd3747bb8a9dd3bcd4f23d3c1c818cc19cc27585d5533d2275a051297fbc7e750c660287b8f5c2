declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a specific filter within a time range (in reverse order)
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param filter - Filter to match time series keys
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, options?: import("./RANGE").TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("./MRANGE").TsMRangeRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: number;
        }[]>;
        readonly 3: (this: void, reply: import("./MRANGE").TsMRangeRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        }[]>;
    };
};
export default _default;
//# sourceMappingURL=MREVRANGE.d.ts.map