import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, UnwrapReply, ArrayReply, NullReply, BlobStringReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Gets values at a specific path from multiple JSON documents.
     * Returns an array of values at the path from each key, null for missing keys/paths.
     *
     * @param parser - The Redis command parser
     * @param keys - Array of keys containing JSON documents
     * @param path - Path to retrieve from each document
     */
    readonly parseCommand: (this: void, parser: CommandParser, keys: Array<RedisArgument>, path: RedisArgument) => void;
    readonly transformReply: (this: void, reply: UnwrapReply<ArrayReply<NullReply | BlobStringReply>>) => (import("@redis/client/dist/lib/commands/generic-transformers").RedisJSON | NullReply)[];
};
export default _default;
//# sourceMappingURL=MGET.d.ts.map