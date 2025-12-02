import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, BlobStringReply, NullReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonObjKeysOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Returns the keys in the object stored in a JSON document.
     * Returns array of keys, array of arrays for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the object to examine
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonObjKeysOptions) => void;
    readonly transformReply: () => ArrayReply<BlobStringReply> | ArrayReply<ArrayReply<BlobStringReply> | NullReply>;
};
export default _default;
//# sourceMappingURL=OBJKEYS.d.ts.map