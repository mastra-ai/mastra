import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
declare const _default: {
    readonly IS_READ_ONLY: true;
    /**
     * Constructs the PEXPIREAT command
     *
     * @param parser - The command parser
     * @param key - The key to set the expiration for
     * @param msTimestamp - The expiration timestamp in milliseconds (Unix timestamp or Date object)
     * @param mode - Optional mode for the command ('NX', 'XX', 'GT', 'LT')
     * @see https://redis.io/commands/pexpireat/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, msTimestamp: number | Date, mode?: 'NX' | 'XX' | 'GT' | 'LT') => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=PEXPIREAT.d.ts.map