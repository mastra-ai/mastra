import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
import { Timestamp, Labels } from './helpers';
import { TsIgnoreOptions } from './ADD';
export interface TsIncrByOptions {
    TIMESTAMP?: Timestamp;
    RETENTION?: number;
    UNCOMPRESSED?: boolean;
    CHUNK_SIZE?: number;
    LABELS?: Labels;
    IGNORE?: TsIgnoreOptions;
}
/**
 * Parses arguments for incrementing a time series value
 * @param parser - The command parser
 * @param key - The key name of the time series
 * @param value - The value to increment by
 * @param options - Optional parameters for the command
 */
export declare function parseIncrByArguments(parser: CommandParser, key: RedisArgument, value: number, options?: TsIncrByOptions): void;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Increases the value of a time series by a given amount
     * @param args - Arguments passed to the {@link parseIncrByArguments} function
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, value: number, options?: TsIncrByOptions | undefined) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=INCRBY.d.ts.map