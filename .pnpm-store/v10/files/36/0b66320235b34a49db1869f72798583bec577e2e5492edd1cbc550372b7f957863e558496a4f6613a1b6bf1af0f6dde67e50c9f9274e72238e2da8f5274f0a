import { CommandParser } from '../client/parser';
import { RedisArgument, ReplyUnion } from '../RESP/types';
import { transformStreamsMessagesReplyResp2 } from './generic-transformers';
/**
 * Structure representing a stream to read from
 *
 * @property key - The stream key
 * @property id - The message ID to start reading from
 */
export interface XReadStream {
    key: RedisArgument;
    id: RedisArgument;
}
export type XReadStreams = Array<XReadStream> | XReadStream;
/**
 * Helper function to push stream keys and IDs to the command parser
 *
 * @param parser - The command parser
 * @param streams - Single stream or array of streams to read from
 */
export declare function pushXReadStreams(parser: CommandParser, streams: XReadStreams): void;
/**
 * Options for the XREAD command
 *
 * @property COUNT - Limit the number of entries returned per stream
 * @property BLOCK - Milliseconds to block waiting for new entries (0 for indefinite)
 */
export interface XReadOptions {
    COUNT?: number;
    BLOCK?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XREAD command to read messages from one or more streams
     *
     * @param parser - The command parser
     * @param streams - Single stream or array of streams to read from
     * @param options - Additional options for reading streams
     * @returns Array of stream entries, each containing the stream name and its messages
     * @see https://redis.io/commands/xread/
     */
    readonly parseCommand: (this: void, parser: CommandParser, streams: XReadStreams, options?: XReadOptions) => void;
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
//# sourceMappingURL=XREAD.d.ts.map