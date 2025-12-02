import { CommandParser } from '@redis/client/dist/lib/client/parser';
import { RedisArgument, NumberReply } from '@redis/client/dist/lib/RESP/types';
export interface FtSugAddOptions {
    INCR?: boolean;
    PAYLOAD?: RedisArgument;
}
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Adds a suggestion string to an auto-complete suggestion dictionary.
     * @param parser - The command parser
     * @param key - The suggestion dictionary key
     * @param string - The suggestion string to add
     * @param score - The suggestion score used for sorting
     * @param options - Optional parameters:
     *   - INCR: If true, increment the existing entry's score
     *   - PAYLOAD: Optional payload to associate with the suggestion
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, string: RedisArgument, score: number, options?: FtSugAddOptions) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=SUGADD.d.ts.map