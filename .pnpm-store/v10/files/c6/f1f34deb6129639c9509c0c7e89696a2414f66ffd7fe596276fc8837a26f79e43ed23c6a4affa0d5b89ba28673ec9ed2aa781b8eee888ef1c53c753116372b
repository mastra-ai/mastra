import { ArrayReply, BlobStringReply, DoubleReply, MapReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Retrieve elements similar to a given vector or element with similarity scores
     * @param args - Same parameters as the VSIM command
     * @see https://redis.io/commands/vsim/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, query: number[] | import("../RESP/types").RedisArgument, options?: import("./VSIM").VSimOptions | undefined) => void;
    readonly transformReply: {
        readonly 2: (reply: ArrayReply<BlobStringReply>) => Record<string, DoubleReply<number>>;
        readonly 3: () => MapReply<BlobStringReply, DoubleReply>;
    };
};
export default _default;
//# sourceMappingURL=VSIM_WITHSCORES.d.ts.map