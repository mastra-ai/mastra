import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, ArrayReply, NumberReply, NullReply } from '@redis/client/dist/lib/RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Toggles a boolean value stored in a JSON document.
     * Returns 1 if value was toggled to true, 0 if toggled to false, or null if path doesn't exist.
     *
     * @param parser - The Redis command parser
     * @param key - The key containing the JSON document
     * @param path - Path to the boolean value
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, path: RedisArgument) => void;
    readonly transformReply: () => NumberReply | NullReply | ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=TOGGLE.d.ts.map