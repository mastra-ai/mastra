import { BlobStringReply, ArrayReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XAUTOCLAIM command with JUSTID option to get only message IDs
     *
     * @param args - Same parameters as XAUTOCLAIM command
     * @returns Object containing nextId and arrays of claimed and deleted message IDs
     * @see https://redis.io/commands/xautoclaim/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, group: import("../RESP/types").RedisArgument, consumer: import("../RESP/types").RedisArgument, minIdleTime: number, start: import("../RESP/types").RedisArgument, options?: import("./XAUTOCLAIM").XAutoClaimOptions | undefined) => void;
    /**
     * Transforms the raw XAUTOCLAIM JUSTID reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @returns Structured object containing nextId, message IDs, and deleted message IDs
     */
    readonly transformReply: (this: void, reply: [nextId: BlobStringReply<string>, messages: ArrayReply<BlobStringReply<string>>, deletedMessages: ArrayReply<BlobStringReply<string>>]) => {
        nextId: BlobStringReply<string>;
        messages: ArrayReply<BlobStringReply<string>>;
        deletedMessages: ArrayReply<BlobStringReply<string>>;
    };
};
export default _default;
//# sourceMappingURL=XAUTOCLAIM_JUSTID.d.ts.map