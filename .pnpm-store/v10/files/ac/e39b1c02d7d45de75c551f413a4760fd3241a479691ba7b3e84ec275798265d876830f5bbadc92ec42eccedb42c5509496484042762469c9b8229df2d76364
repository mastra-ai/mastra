import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, NumberReply } from '../RESP/types';
import { LPosOptions } from './LPOS';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LPOS command with COUNT option
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param element - The element to search for
     * @param count - The number of positions to return
     * @param options - Optional parameters for RANK and MAXLEN
     * @see https://redis.io/commands/lpos/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, element: RedisArgument, count: number, options?: LPosOptions) => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=LPOS_COUNT.d.ts.map