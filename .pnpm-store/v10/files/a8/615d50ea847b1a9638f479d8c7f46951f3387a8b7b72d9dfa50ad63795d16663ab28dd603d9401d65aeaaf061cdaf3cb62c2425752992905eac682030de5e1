import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply, ArrayReply, NullReply } from '@redis/client/dist/lib/RESP/types';
import { RedisJSON } from '@redis/client/dist/lib/commands/generic-transformers';
export interface JsonArrIndexOptions {
    range?: {
        start: number;
        stop?: number;
    };
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the index of the first occurrence of a value in a JSON array.
     * If the specified value is not found, it returns -1, or null if the path does not exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param path - Path to the array in the JSON document
     * @param json - The value to search for
     * @param options - Optional range parameters for the search
     * @param options.range.start - Starting index for the search
     * @param options.range.stop - Optional ending index for the search
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument, json: RedisJSON, options?: JsonArrIndexOptions) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=ARRINDEX.d.ts.map