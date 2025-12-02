import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, UnwrapReply, TypeMapping } from '../RESP/types';
import { StreamMessageRawReply } from './generic-transformers';
/**
 * Options for the XRANGE command
 *
 * @property COUNT - Limit the number of entries returned
 */
export interface XRangeOptions {
    COUNT?: number;
}
/**
 * Helper function to build XRANGE command arguments
 *
 * @param start - Start of ID range (use '-' for minimum ID)
 * @param end - End of ID range (use '+' for maximum ID)
 * @param options - Additional options for the range query
 * @returns Array of arguments for the XRANGE command
 */
export declare function xRangeArguments(start: RedisArgument, end: RedisArgument, options?: XRangeOptions): RedisArgument[];
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XRANGE command to read stream entries in a specific range
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param args - Arguments tuple containing start ID, end ID, and options
     * @returns Array of messages in the specified range
     * @see https://redis.io/commands/xrange/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, start: RedisArgument, end: RedisArgument, options?: XRangeOptions | undefined) => void;
    /**
     * Transforms the raw XRANGE reply into structured message objects
     *
     * @param reply - Raw reply from Redis
     * @param preserve - Preserve options (unused)
     * @param typeMapping - Type mapping for message fields
     * @returns Array of structured message objects
     */
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<StreamMessageRawReply>>, preserve?: any, typeMapping?: TypeMapping) => import("./generic-transformers").StreamMessageReply[];
};
export default _default;
//# sourceMappingURL=XRANGE.d.ts.map