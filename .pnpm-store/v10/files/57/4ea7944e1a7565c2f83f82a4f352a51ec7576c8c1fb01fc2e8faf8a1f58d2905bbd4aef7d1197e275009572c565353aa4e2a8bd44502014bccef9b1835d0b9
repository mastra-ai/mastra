import { CommandParser } from "../client/parser";
import { RedisArgument, ArrayReply } from "../RESP/types";
import { StreamDeletionPolicy, StreamDeletionReplyCode } from "./common-stream.types";
import { RedisVariadicArgument } from "./generic-transformers";
/**
 * Deletes one or multiple entries from the stream
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XDELEX command to delete one or multiple entries from the stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param id - One or more message IDs to delete
     * @param policy - Policy to apply when deleting entries (optional, defaults to KEEPREF)
     * @returns Array of integers: -1 (not found), 1 (deleted), 2 (dangling refs)
     * @see https://redis.io/commands/xdelex/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, id: RedisVariadicArgument, policy?: StreamDeletionPolicy) => void;
    readonly transformReply: () => ArrayReply<StreamDeletionReplyCode>;
};
export default _default;
//# sourceMappingURL=XDELEX.d.ts.map