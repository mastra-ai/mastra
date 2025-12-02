import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NullReply, NumberReply, ArrayReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonStrAppendOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Appends a string to a string value stored in a JSON document.
     * Returns new string length after append, or null if the path doesn't exist or value is not a string.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param append - String to append
     * @param options - Optional parameters
     * @param options.path - Path to the string value
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, append: string, options?: JsonStrAppendOptions) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NullReply | NumberReply>;
};
export default _default;
//# sourceMappingURL=STRAPPEND.d.ts.map