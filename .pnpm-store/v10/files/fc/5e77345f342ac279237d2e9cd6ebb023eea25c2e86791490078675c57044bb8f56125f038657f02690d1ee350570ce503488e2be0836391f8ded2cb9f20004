import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NullReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
export interface RedisArrPopOptions {
    path: RedisArgument;
    index?: number;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Removes and returns an element from an array in a JSON document.
     * Returns null if the path does not exist or the value is not an array.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param options - Optional parameters
     * @param options.path - Path to the array in the JSON document
     * @param options.index - Optional index to pop from. Default is -1 (last element)
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: RedisArrPopOptions) => void;
    readonly transformReply: (this: void, reply: NullReply | BlobStringReply | ArrayReply<NullReply | BlobStringReply>) => string | number | boolean | Date | {
        [key: string]: import("@redis/client/dist/lib/commands/generic-transformers").RedisJSON;
        [key: number]: import("@redis/client/dist/lib/commands/generic-transformers").RedisJSON;
    } | NullReply | (import("@redis/client/dist/lib/commands/generic-transformers").RedisJSON | NullReply)[] | null;
};
export default _default;
//# sourceMappingURL=ARRPOP.d.ts.map