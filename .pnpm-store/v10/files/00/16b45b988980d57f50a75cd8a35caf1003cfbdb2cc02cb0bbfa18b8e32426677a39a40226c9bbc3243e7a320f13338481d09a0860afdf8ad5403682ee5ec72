import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisVariadicArgument, transformRedisJsonNullReply } from '@redis/client/dist/lib/commands/generic-transformers';
export interface JsonGetOptions {
    path?: RedisVariadicArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Gets values from a JSON document.
     * Returns the value at the specified path, or null if the key or path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path(s) to the value(s) to retrieve
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonGetOptions) => void;
    readonly transformReply: typeof transformRedisJsonNullReply;
};
export default _default;
//# sourceMappingURL=GET.d.ts.map