import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply, ArrayReply, NullReply } from '@redis/client/dist/lib/RESP/types';
import { RedisJSON } from '@redis/client/dist/lib/commands/generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Inserts one or more values into an array at the specified index.
     * Returns the new array length after insert, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param path - Path to the array in the JSON document
     * @param index - The position where to insert the values
     * @param json - The first value to insert
     * @param jsons - Additional values to insert
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument, index: number, json: RedisJSON, ...jsons: Array<RedisJSON>) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=ARRINSERT.d.ts.map