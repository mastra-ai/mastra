import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonClearOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Clears container values (arrays/objects) in a JSON document.
     * Returns the number of values cleared (0 or 1), or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the container to clear
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonClearOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=CLEAR.d.ts.map