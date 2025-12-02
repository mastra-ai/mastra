import { BlobStringReply, NullReply } from '../RESP/types';
/**
 * Command for adding entries to an existing stream without creating it if it doesn't exist
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XADD command with NOMKSTREAM option to append a new entry to an existing stream
     *
     * @param args - Arguments tuple containing parser, key, id, message, and options
     * @returns The ID of the added entry, or null if the stream doesn't exist
     * @see https://redis.io/commands/xadd/
     */
    readonly parseCommand: (this: void, parser: import("../..").CommandParser, key: import("../RESP/types").RedisArgument, id: import("../RESP/types").RedisArgument, message: Record<string, import("../RESP/types").RedisArgument>, options?: import("./XADD").XAddOptions | undefined) => void;
    readonly transformReply: () => BlobStringReply | NullReply;
};
export default _default;
//# sourceMappingURL=XADD_NOMKSTREAM.d.ts.map