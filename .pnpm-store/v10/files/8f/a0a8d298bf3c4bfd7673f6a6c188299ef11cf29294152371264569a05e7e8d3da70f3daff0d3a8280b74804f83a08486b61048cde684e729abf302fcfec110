import { CommandParser } from '../client/parser';
import { NumberReply, RedisArgument } from '../RESP/types';
import { RedisVariadicArgument } from './generic-transformers';
export type BitOperations = 'AND' | 'OR' | 'XOR' | 'NOT' | 'DIFF' | 'DIFF1' | 'ANDOR' | 'ONE';
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Performs bitwise operations between strings
     * @param parser - The Redis command parser
     * @param operation - Bitwise operation to perform: AND, OR, XOR, NOT, DIFF, DIFF1, ANDOR, ONE
     * @param destKey - Destination key to store the result
     * @param key - Source key(s) to perform operation on
     */
    readonly parseCommand: (this: void, parser: CommandParser, operation: BitOperations, destKey: RedisArgument, key: RedisVariadicArgument) => void;
    readonly transformReply: () => NumberReply;
};
export default _default;
//# sourceMappingURL=BITOP.d.ts.map