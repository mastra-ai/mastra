import { CommandParser } from "../client/parser";
import { RedisArgument, ArrayReply } from "../RESP/types";
import { StreamDeletionReplyCode, StreamDeletionPolicy } from "./common-stream.types";
import { RedisVariadicArgument } from "./generic-transformers";
/**
 * Acknowledges and deletes one or multiple messages for a stream consumer group
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XACKDEL command to acknowledge and delete one or multiple messages for a stream consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param id - One or more message IDs to acknowledge and delete
     * @param policy - Policy to apply when deleting entries (optional, defaults to KEEPREF)
     * @returns Array of integers: -1 (not found), 1 (acknowledged and deleted), 2 (acknowledged with dangling refs)
     * @see https://redis.io/commands/xackdel/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, id: RedisVariadicArgument, policy?: StreamDeletionPolicy) => void;
    readonly transformReply: () => ArrayReply<StreamDeletionReplyCode>;
};
export default _default;
//# sourceMappingURL=XACKDEL.d.ts.map