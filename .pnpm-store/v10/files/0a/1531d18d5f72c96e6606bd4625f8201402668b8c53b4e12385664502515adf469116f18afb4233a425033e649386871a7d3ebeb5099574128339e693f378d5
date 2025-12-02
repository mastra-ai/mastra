import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NumberReply, NullReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonStrLenOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the length of a string value stored in a JSON document.
     * Returns string length, array of lengths for multiple paths, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param options - Optional parameters
     * @param options.path - Path to the string value
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonStrLenOptions) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=STRLEN.d.ts.map