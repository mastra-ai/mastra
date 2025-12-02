import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { SimpleStringReply, RedisArgument } from '@redis/client/dist/lib/RESP/types';
import { RedisJSON } from '@redis/client/dist/lib/commands/generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Merges a given JSON value into a JSON document.
     * Returns OK on success, or null if the key does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to merge into
     * @param value - JSON value to merge
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument, value: RedisJSON) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MERGE.d.ts.map