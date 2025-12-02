import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply, ArrayReply, NullReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonObjLenOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the number of keys in the object stored in a JSON document.
     * Returns length of object, array of lengths for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the object to examine
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonObjLenOptions) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=OBJLEN.d.ts.map