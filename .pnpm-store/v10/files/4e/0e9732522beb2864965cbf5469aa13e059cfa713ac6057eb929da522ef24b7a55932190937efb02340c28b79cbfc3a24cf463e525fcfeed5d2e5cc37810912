import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisJSON } from '@redis/client/dist/lib/commands/generic-transformers';
import { RedisArgument, NumberReply, ArrayReply, NullReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Appends one or more values to the end of an array in a JSON document.
     * Returns the new array length after append, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key to append to
     * @param path - Path to the array in the JSON document
     * @param json - The first value to append
     * @param jsons - Additional values to append
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument, json: RedisJSON, ...jsons: Array<RedisJSON>) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=ARRAPPEND.d.ts.map