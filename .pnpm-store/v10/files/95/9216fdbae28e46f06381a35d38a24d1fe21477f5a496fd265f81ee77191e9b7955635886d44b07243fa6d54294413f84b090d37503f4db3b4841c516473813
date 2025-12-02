import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
type LInsertPosition = 'BEFORE' | 'AFTER';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the LINSERT command
     *
     * @param parser - The command parser
     * @param key - The key of the list
     * @param position - The position where to insert (BEFORE or AFTER)
     * @param pivot - The element to find in the list
     * @param element - The element to insert
     * @see https://redis.io/commands/linsert/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, position: LInsertPosition, pivot: RedisArgument, element: RedisArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=LINSERT.d.ts.map