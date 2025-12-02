import { CommandParser } from '../client/parser';
import { RedisArgument, CommandArguments, BlobStringReply, ArrayReply } from '../RESP/types';
/**
 * Common options for SCAN-type commands
 *
 * @property MATCH - Pattern to filter returned keys
 * @property COUNT - Hint for how many elements to return per iteration
 */
export interface ScanCommonOptions {
    MATCH?: string;
    COUNT?: number;
}
/**
 * Parses scan arguments for SCAN-type commands
 *
 * @param parser - The command parser
 * @param cursor - The cursor position for iteration
 * @param options - Scan options
 */
export declare function parseScanArguments(parser: CommandParser, cursor: RedisArgument, options?: ScanOptions): void;
/**
 * Pushes scan arguments to the command arguments array
 *
 * @param args - The command arguments array
 * @param cursor - The cursor position for iteration
 * @param options - Scan options
 * @returns The updated command arguments array
 */
export declare function pushScanArguments(args: CommandArguments, cursor: RedisArgument, options?: ScanOptions): CommandArguments;
/**
 * Options for the SCAN command
 *
 * @property TYPE - Filter by value type
 */
export interface ScanOptions extends ScanCommonOptions {
    TYPE?: RedisArgument;
}
declare const _default: {
    readonly NOT_KEYED_COMMAND: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the SCAN command
     *
     * @param parser - The command parser
     * @param cursor - The cursor position to start scanning from
     * @param options - Scan options
     * @see https://redis.io/commands/scan/
     */
    readonly parseCommand: (this: void, parser: CommandParser, cursor: RedisArgument, options?: ScanOptions) => void;
    /**
     * Transforms the SCAN reply into a structured object
     *
     * @param reply - The raw reply containing cursor and keys
     * @returns Object with cursor and keys properties
     */
    readonly transformReply: (this: void, [cursor, keys]: [BlobStringReply, ArrayReply<BlobStringReply>]) => {
        cursor: BlobStringReply<string>;
        keys: ArrayReply<BlobStringReply<string>>;
    };
};
export default _default;
//# sourceMappingURL=SCAN.d.ts.map