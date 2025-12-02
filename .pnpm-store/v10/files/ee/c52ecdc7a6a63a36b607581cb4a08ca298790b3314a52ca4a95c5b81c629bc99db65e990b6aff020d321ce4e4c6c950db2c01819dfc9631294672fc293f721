import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
import { BitValue } from './generic-transformers';
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the position of first bit set to 0 or 1 in a string
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param bit - The bit value to look for (0 or 1)
     * @param start - Optional starting position in bytes/bits
     * @param end - Optional ending position in bytes/bits
     * @param mode - Optional counting mode: BYTE or BIT
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, bit: BitValue, start?: number, end?: number, mode?: 'BYTE' | 'BIT') => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=BITPOS.d.ts.map