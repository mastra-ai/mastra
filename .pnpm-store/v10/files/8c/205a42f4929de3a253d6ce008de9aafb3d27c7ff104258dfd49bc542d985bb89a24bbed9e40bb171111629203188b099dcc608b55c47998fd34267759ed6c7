import { CommandParser } from '../client/parser';
import { NumberReply, NullReply, RedisArgument } from '../RESP/types';
export interface MemoryUsageOptions {
    SAMPLES?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the MEMORY USAGE command
     *
     * @param parser - The command parser
     * @param key - The key to get memory usage for
     * @param options - Optional parameters including SAMPLES
     * @see https://redis.io/commands/memory-usage/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: MemoryUsageOptions) => void;
    readonly transformReply: () => NumberReply | NullReply;
};
export default _default;
//# sourceMappingURL=MEMORY_USAGE.d.ts.map