import { CommandParser } from '../client/parser';
import { RedisArgument, NumberReply } from '../RESP/types';
export interface BitCountRange {
    start: number;
    end: number;
    mode?: 'BYTE' | 'BIT';
}
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Returns the count of set bits in a string key
     * @param parser - The Redis command parser
     * @param key - The key to count bits in
     * @param range - Optional range specification
     * @param range.start - Start offset in bytes/bits
     * @param range.end - End offset in bytes/bits
     * @param range.mode - Optional counting mode: BYTE or BIT
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, range?: BitCountRange) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=BITCOUNT.d.ts.map