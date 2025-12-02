import { CommandParser } from '../client/parser';
import { RedisArgument, BlobStringReply } from '../RESP/types';
import { StreamDeletionPolicy } from './common-stream.types';
/**
 * Options for the XADD command
 *
 * @property TRIM - Optional trimming configuration
 * @property TRIM.strategy - Trim strategy: MAXLEN (by length) or MINID (by ID)
 * @property TRIM.strategyModifier - Exact ('=') or approximate ('~') trimming
 * @property TRIM.threshold - Maximum stream length or minimum ID to retain
 * @property TRIM.limit - Maximum number of entries to trim in one call
 * @property TRIM.policy - Policy to apply when trimming entries (optional, defaults to KEEPREF)
 */
export interface XAddOptions {
    TRIM?: {
        strategy?: 'MAXLEN' | 'MINID';
        strategyModifier?: '=' | '~';
        threshold: number;
        limit?: number;
        /** added in 8.2 */
        policy?: StreamDeletionPolicy;
    };
}
/**
 * Parses arguments for the XADD command
 *
 * @param optional - Optional command modifier
 * @param parser - The command parser
 * @param key - The stream key
 * @param id - Message ID (* for auto-generation)
 * @param message - Key-value pairs representing the message fields
 * @param options - Additional options for stream trimming
 */
export declare function parseXAddArguments(optional: RedisArgument | undefined, parser: CommandParser, key: RedisArgument, id: RedisArgument, message: Record<string, RedisArgument>, options?: XAddOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the XADD command to append a new entry to a stream
     *
     * @param parser - The command parser
     * @param key - The stream key
     * @param id - Message ID (* for auto-generation)
     * @param message - Key-value pairs representing the message fields
     * @param options - Additional options for stream trimming
     * @returns The ID of the added entry
     * @see https://redis.io/commands/xadd/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, id: RedisArgument, message: Record<string, RedisArgument>, options?: XAddOptions | undefined) => void;
    readonly transformReply: () => BlobStringReply;
};
export default _default;
//# sourceMappingURL=XADD.d.ts.map