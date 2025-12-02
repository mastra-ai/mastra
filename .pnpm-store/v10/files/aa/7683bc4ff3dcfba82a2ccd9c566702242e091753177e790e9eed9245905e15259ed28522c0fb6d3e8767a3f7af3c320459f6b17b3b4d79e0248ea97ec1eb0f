import { CommandParser } from '../client/parser';
import { RedisArgument, TuplesReply, BlobStringReply, ArrayReply, NullReply, TypeMapping } from '../RESP/types';
import { StreamMessageRawReply } from './generic-transformers';
/**
 * Options for the XAUTOCLAIM command
 *
 * @property COUNT - Limit the number of messages to claim
 */
export interface XAutoClaimOptions {
    COUNT?: number;
}
/**
 * Raw reply structure for XAUTOCLAIM command
 *
 * @property nextId - The ID to use for the next XAUTOCLAIM call
 * @property messages - Array of claimed messages or null entries
 * @property deletedMessages - Array of message IDs that no longer exist
 */
export type XAutoClaimRawReply = TuplesReply<[
    nextId: BlobStringReply,
    messages: ArrayReply<StreamMessageRawReply | NullReply>,
    deletedMessages: ArrayReply<BlobStringReply>
]>;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XAUTOCLAIM command to automatically claim pending messages in a consumer group
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param group - The consumer group name
     * @param consumer - The consumer name that will claim the messages
     * @param minIdleTime - Minimum idle time in milliseconds for a message to be claimed
     * @param start - Message ID to start scanning from
     * @param options - Additional options for the claim operation
     * @returns Object containing nextId, claimed messages, and list of deleted message IDs
     * @see https://redis.io/commands/xautoclaim/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, group: RedisArgument, consumer: RedisArgument, minIdleTime: number, start: RedisArgument, options?: XAutoClaimOptions) => void;
    /**
     * Transforms the raw XAUTOCLAIM reply into a structured object
     *
     * @param reply - Raw reply from Redis
     * @param preserve - Preserve options (unused)
     * @param typeMapping - Type mapping for message fields
     * @returns Structured object containing nextId, messages, and deletedMessages
     */
    readonly transformReply: (this: void, reply: [nextId: BlobStringReply<string>, messages: ArrayReply<NullReply | StreamMessageRawReply>, deletedMessages: ArrayReply<BlobStringReply<string>>], preserve?: any, typeMapping?: TypeMapping) => {
        nextId: BlobStringReply<string>;
        messages: (NullReply | import("./generic-transformers").StreamMessageReply)[];
        deletedMessages: ArrayReply<BlobStringReply<string>>;
    };
};
export default _default;
//# sourceMappingURL=XAUTOCLAIM.d.ts.map