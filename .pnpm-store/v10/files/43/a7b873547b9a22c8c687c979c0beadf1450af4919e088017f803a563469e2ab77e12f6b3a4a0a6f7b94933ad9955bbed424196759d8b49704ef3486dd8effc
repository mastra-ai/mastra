import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonDebugMemoryOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Reports memory usage details for a JSON document value.
     * Returns size in bytes of the value, or null if the key or path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the value to examine
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonDebugMemoryOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=DEBUG_MEMORY.d.ts.map