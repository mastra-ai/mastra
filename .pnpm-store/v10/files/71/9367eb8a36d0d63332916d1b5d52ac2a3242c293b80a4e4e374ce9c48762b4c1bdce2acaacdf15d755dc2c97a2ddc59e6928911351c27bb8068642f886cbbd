import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, NumberReply } from '../RESP/types';
import { BitFieldGetOperation } from './BITFIELD';
export type BitFieldRoOperations = Array<Omit<BitFieldGetOperation, 'operation'>>;
declare const _default: {
    readonly CACHEABLE: true;
    readonly IS_READ_ONLY: true;
    /**
     * Performs read-only bitfield integer operations on strings
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param operations - Array of GET operations to perform on the bitfield
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, operations: BitFieldRoOperations) => void;
    readonly transformReply: () => ArrayReply<NumberReply>;
};
export default _default;
//# sourceMappingURL=BITFIELD_RO.d.ts.map