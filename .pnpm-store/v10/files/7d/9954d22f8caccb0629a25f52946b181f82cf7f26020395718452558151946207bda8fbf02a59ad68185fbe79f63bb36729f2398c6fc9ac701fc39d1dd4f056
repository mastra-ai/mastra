import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { BitValue } from './generic-transformers';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Constructs the SETBIT command
     *
     * @param parser - The command parser
     * @param key - The key to set the bit on
     * @param offset - The bit offset (zero-based)
     * @param value - The bit value (0 or 1)
     * @see https://redis.io/commands/setbit/
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, offset: number, value: BitValue) => void;
    readonly transformReply: () => NumberReply<BitValue>;
};
export default _default;
//# sourceMappingURL=SETBIT.d.ts.map