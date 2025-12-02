declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples from a time series within a time range (in reverse order)
     * @param args - Arguments passed to the {@link transformRangeArguments} function
     */
    readonly parseCommand: (this: void, parser: import("@redis/client").CommandParser, key: import("@redis/client/dist/lib/RESP/types").RedisArgument, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, options?: import("./RANGE").TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("@redis/client/dist/lib/RESP/types").RespType<42, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[], never, import("@redis/client/dist/lib/RESP/types").RespType<42, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>], never, [import("@redis/client/dist/lib/RESP/types").NumberReply<number>, import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>]>[]>) => {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: number;
        }[];
        readonly 3: (this: void, reply: import("./helpers").SamplesRawReply) => {
            timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
            value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
        }[];
    };
};
export default _default;
//# sourceMappingURL=REVRANGE.d.ts.map