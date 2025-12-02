import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { NullReply, BlobStringReply, ArrayReply, RedisArgument, UnwrapReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonTypeOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the type of JSON value at a specific path in a JSON document.
     * Returns the type as a string, array of types for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to examine
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonTypeOptions) => void;
    readonly transformReply: {
        readonly 2: () => NullReply | BlobStringReply | ArrayReply<BlobStringReply | NullReply>;
        readonly 3: (reply: UnwrapReply<ArrayReply<NullReply | BlobStringReply | ArrayReply<BlobStringReply | NullReply>>>) => NullReply | BlobStringReply<string> | ArrayReply<NullReply | BlobStringReply<string>>;
    };
};
export default _default;
//# sourceMappingURL=TYPE.d.ts.map