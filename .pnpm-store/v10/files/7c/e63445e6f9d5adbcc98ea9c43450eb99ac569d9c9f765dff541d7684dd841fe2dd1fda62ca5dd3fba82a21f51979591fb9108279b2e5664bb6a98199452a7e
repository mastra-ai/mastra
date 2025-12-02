import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, SimpleStringReply } from '@redis/client/dist/lib/RESP/types';
import { RedisJSON } from '@redis/client/dist/lib/commands/generic-transformers';
export interface JsonMSetItem {
    key: RedisArgument;
    path: RedisArgument;
    value: RedisJSON;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Sets multiple JSON values in multiple documents.
     * Returns OK on success.
     *
     * @param parser - The Redis command parser
     * @param items - Array of objects containing key, path, and value to set
     * @param items[].key - The key containing the JSON document
     * @param items[].path - Path in the document to set
     * @param items[].value - JSON value to set at the path
     */
    readonly parseCommand: (this: void, parser: CommandParser, items: Array<JsonMSetItem>) => void;
    readonly transformReply: () => SimpleStringReply<'OK'>;
};
export default _default;
//# sourceMappingURL=MSET.d.ts.map