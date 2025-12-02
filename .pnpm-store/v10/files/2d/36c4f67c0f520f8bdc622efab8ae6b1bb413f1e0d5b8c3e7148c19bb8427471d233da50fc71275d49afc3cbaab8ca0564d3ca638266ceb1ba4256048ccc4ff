import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonDelOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Deletes a value from a JSON document.
     * Returns the number of paths deleted (0 or 1), or null if the key does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the value to delete
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonDelOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=DEL.d.ts.map