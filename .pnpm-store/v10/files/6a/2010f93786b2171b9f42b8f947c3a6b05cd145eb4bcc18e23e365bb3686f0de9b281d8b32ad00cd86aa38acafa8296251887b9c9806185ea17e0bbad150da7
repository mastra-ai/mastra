import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, NullReply, UnwrapReply, TypeMapping } from '../RESP/types';
import { RedisVariadicArgument, StreamMessageRawReply } from './generic-transformers';
/**
 * Options for the XCLAIM command
 *
 * @property IDLE - Set the idle time (in milliseconds) for the claimed messages
 * @property TIME - Set the last delivery time (Unix timestamp or Date)
 * @property RETRYCOUNT - Set the retry counter for the claimed messages
 * @property FORCE - Create the pending message entry even if the message doesn't exist
 * @property LASTID - Update the consumer group last ID
 */
export interface XClaimOptions {
    IDLE?: number;
    TIME?: number | Date;
    RETRYCOUNT?: number;
    FORCE?: boolean;
    LASTID?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XCLAIM command to claim pending messages in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param consumer - The consumer name that will claim the messages
     * @param minIdleTime - Minimum idle time in milliseconds for a message to be claimed
     * @param id - One or more message IDs to claim
     * @param options - Additional options for the claim operation
     * @returns Array of claimed messages
     * @see https://redis.io/commands/xclaim/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, consumer: RedisArgument, minIdleTime: number, id: RedisVariadicArgument, options?: XClaimOptions) => void;
    /**
     * Transforms the raw XCLAIM reply into an array of messages
     *
     * @param reply - Raw reply from Redis
     * @param preserve - Preserve options (unused)
     * @param typeMapping - Type mapping for message fields
     * @returns Array of claimed messages with their fields
     */
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<StreamMessageRawReply | NullReply>>, preserve?: any, typeMapping?: TypeMapping) => (NullReply | import("./generic-transformers").StreamMessageReply)[];
};
export default _default;
//# sourceMappingURL=XCLAIM.d.ts.map