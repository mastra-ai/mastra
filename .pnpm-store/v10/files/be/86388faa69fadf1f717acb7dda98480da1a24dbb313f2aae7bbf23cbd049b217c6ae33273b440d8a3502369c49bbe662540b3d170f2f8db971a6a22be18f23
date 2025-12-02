declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets samples for time series matching a filter with selected labels and grouping (in reverse order)
     * @param parser - The command parser
     * @param fromTimestamp - Start timestamp for range
     * @param toTimestamp - End timestamp for range
     * @param selectedLabels - Labels to include in the output
     * @param filter - Filter to match time series keys
     * @param groupBy - Group by parameters
     * @param options - Optional parameters for the command
     */
    readonly parseCommand: (parser: import("@redis/client").CommandParser, fromTimestamp: import("./helpers").Timestamp, toTimestamp: import("./helpers").Timestamp, selectedLabels: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, filter: import("@redis/client/dist/lib/commands/generic-transformers").RedisVariadicArgument, groupBy: import("./MRANGE_GROUPBY").TsMRangeGroupBy, options?: import("./RANGE").TsRangeOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (this: void, reply: import("./MRANGE_SELECTED_LABELS").TsMRangeSelectedLabelsRawReply2, _?: any, typeMapping?: import("@redis/client/dist/lib/RESP/types").TypeMapping | undefined) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
            labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: number;
            }[];
        }>;
        readonly 3: (this: void, reply: import("./MRANGE_SELECTED_LABELS_GROUPBY").TsMRangeWithLabelsGroupByRawReply3) => import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, {
            labels: import("@redis/client/dist/lib/RESP/types").MapReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>, import("@redis/client/dist/lib/RESP/types").NullReply | import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            sources: import("@redis/client/dist/lib/RESP/types").ArrayReply<import("@redis/client/dist/lib/RESP/types").BlobStringReply<string>>;
            samples: {
                timestamp: import("@redis/client/dist/lib/RESP/types").NumberReply<number>;
                value: import("@redis/client/dist/lib/RESP/types").DoubleReply<number>;
            }[];
        }>;
    };
};
export default _default;
//# sourceMappingURL=MREVRANGE_SELECTED_LABELS_GROUPBY.d.ts.map