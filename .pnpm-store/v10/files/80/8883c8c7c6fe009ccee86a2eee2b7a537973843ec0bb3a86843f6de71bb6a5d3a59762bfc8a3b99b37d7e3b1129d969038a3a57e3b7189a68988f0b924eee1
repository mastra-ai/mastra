import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NumberReply, NullReply } from '@redis/client/dist/lib/RESP/types';
export interface JsonArrLenOptions {
    path?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Returns the length of an array in a JSON document.
     * Returns null if the path does not exist or the value is not an array.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the array
     * @param options - Optional parameters
     * @param options.path - Path to the array in the JSON document
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, options?: JsonArrLenOptions) => void;
    readonly transformReply: () => NumberReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=ARRLEN.d.ts.map