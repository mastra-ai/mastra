import { CommandParser } from '../client/parser';
import { RedisArgument } from '../RESP/types';
/**
 * Options for the XREVRANGE command
 *
 * @property COUNT - Limit the number of entries returned
 */
export interface XRevRangeOptions {
    COUNT?: number;
}
/**
 * Command for reading stream entries in reverse order
 */
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the XREVRANGE command to read stream entries in reverse order
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param args - Arguments tuple containing start ID, end ID, and options
     * @returns Array of messages in the specified range in reverse order
     * @see https://redis.io/commands/xrevrange/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, start: RedisArgument, end: RedisArgument, options?: import("./XRANGE").XRangeOptions | undefined) => void;
    readonly transformReply: (this: void, reply: import("./generic-transformers").StreamMessageRawReply[], preserve?: any, typeMapping?: import("../RESP/types").TypeMapping | undefined) => import("./generic-transformers").StreamMessageReply[];
};
export default _default;
//# sourceMappingURL=XREVRANGE.d.ts.map