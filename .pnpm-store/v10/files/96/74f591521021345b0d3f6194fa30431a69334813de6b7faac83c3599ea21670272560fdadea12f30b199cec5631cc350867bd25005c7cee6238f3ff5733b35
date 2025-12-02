import { CommandParser } from '../client/parser';
import { RedisArgument, ReplyUnion } from '../RESP/types';
import { XReadStreams } from './XREAD';
import { transformStreamsMessagesReplyResp2 } from './generic-transformers';
/**
 * Options for the XREADGROUP command
 *
 * @property COUNT - Limit the number of entries returned per stream
 * @property BLOCK - Milliseconds to block waiting for new entries (0 for indefinite)
 * @property NOACK - Skip adding the message to the PEL (Pending Entries List)
 */
export interface XReadGroupOptions {
    COUNT?: number;
    BLOCK?: number;
    NOACK?: boolean;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XREADGROUP command to read messages from streams as a consumer group member
     *
     * @param parser - The command parser
     * @param group - Name of the consumer group
     * @param consumer - Name of the consumer in the group
     * @param streams - Single stream or array of streams to read from
     * @param options - Additional options for reading streams
     * @returns Array of stream entries, each containing the stream name and its messages
     * @see https://redis.io/commands/xreadgroup/
     */
    readonly parseCommand: (this: void, parser: CommandParser, group: RedisArgument, consumer: RedisArgument, streams: XReadStreams, options?: XReadGroupOptions) => void;
    /**
     * Transform functions for different RESP versions
     */
    readonly transformReply: {
        readonly 2: typeof transformStreamsMessagesReplyResp2;
        readonly 3: () => ReplyUnion;
    };
    readonly unstableResp3: true;
};
export default _default;
//# sourceMappingURL=XREADGROUP.d.ts.map