import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply, NullReply } from '../RESP/types';
export interface LPosOptions {
    RANK?: number;
    MAXLEN?: number;
}
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LPOS command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param element - The element to search for
     * @param options - Optional parameters for RANK and MAXLEN
     * @see https://redis.io/commands/lpos/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument, options?: LPosOptions) => void;
    readonly transformReply: () => NumberReply | NullReply;
};
export default _default;
//# sourceMappingURL=LPOS.d.ts.map