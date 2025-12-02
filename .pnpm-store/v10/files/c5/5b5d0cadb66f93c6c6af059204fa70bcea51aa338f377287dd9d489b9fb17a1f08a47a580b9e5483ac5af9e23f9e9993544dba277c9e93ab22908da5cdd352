import { CommandParser } from '../client/parser';
import { NumberReply, RedisArgument } from '../RESP/types';
import { StreamDeletionPolicy } from './common-stream.types';
/**
 * Options for the XTRIM command
 *
 * @property strategyModifier - Exact ('=') or approximate ('~') trimming
 * @property LIMIT - Maximum number of entries to trim in one call (Redis 6.2+)
 * @property policy - Policy to apply when deleting entries (optional, defaults to KEEPREF)
 */
export interface XTrimOptions {
    strategyModifier?: '=' | '~';
    /** added in 6.2 */
    LIMIT?: number;
    /** added in 8.2 */
    policy?: StreamDeletionPolicy;
}
/**
 * Command for trimming a stream to a specified length or minimum ID
 */
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XTRIM command to trim a stream by length or minimum ID
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param strategy - Trim by maximum length (MAXLEN) or minimum ID (MINID)
     * @param threshold - Maximum length or minimum ID threshold
     * @param options - Additional options for trimming
     * @returns Number of entries removed from the stream
     * @see https://redis.io/commands/xtrim/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, strategy: 'MAXLEN' | 'MINID', threshold: number | string, options?: XTrimOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=XTRIM.d.ts.map