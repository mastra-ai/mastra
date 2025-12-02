import { ArrayReply, BlobStringReply } from '../RESP/types';
/**
 * Command variant for XCLAIM that returns only message IDs
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XCLAIM command with JUSTID option to get only message IDs
     *
     * @param args - Same parameters as XCLAIM command
     * @returns Array of successfully claimed message IDs
     * @see https://redis.io/commands/xclaim/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, group: import("../RESP/types").RedisArgument, consumer: import("../RESP/types").RedisArgument, minIdleTime: number, id: import("./generic-transformers").RedisVariadicArgument, options?: import("./XCLAIM").XClaimOptions | undefined) => void;
    /**
     * Transforms the XCLAIM JUSTID reply into an array of message IDs
     *
     * @returns Array of claimed message IDs
     */
    readonly transformReply: () => ArrayReply<BlobStringReply>;
};
export default _default;
//# sourceMappingURL=XCLAIM_JUSTID.d.ts.map