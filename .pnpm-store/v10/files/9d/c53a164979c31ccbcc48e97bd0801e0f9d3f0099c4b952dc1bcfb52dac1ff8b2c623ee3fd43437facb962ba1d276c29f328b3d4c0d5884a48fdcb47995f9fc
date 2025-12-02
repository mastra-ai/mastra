import { CommandParser } from '../client/parser';
import { RedisArgument, ArrayReply, NumberReply, NullReply } from '../RESP/types';
export type BitFieldEncoding = `${'i' | 'u'}${number}`;
export interface BitFieldOperation<S extends string> {
    operation: S;
}
export interface BitFieldGetOperation extends BitFieldOperation<'GET'> {
    encoding: BitFieldEncoding;
    offset: number | string;
}
export interface BitFieldSetOperation extends BitFieldOperation<'SET'> {
    encoding: BitFieldEncoding;
    offset: number | string;
    value: number;
}
export interface BitFieldIncrByOperation extends BitFieldOperation<'INCRBY'> {
    encoding: BitFieldEncoding;
    offset: number | string;
    increment: number;
}
export interface BitFieldOverflowOperation extends BitFieldOperation<'OVERFLOW'> {
    behavior: string;
}
export type BitFieldOperations = Array<BitFieldGetOperation | BitFieldSetOperation | BitFieldIncrByOperation | BitFieldOverflowOperation>;
export type BitFieldRoOperations = Array<Omit<BitFieldGetOperation, 'operation'>>;
declare const _default: {
    readonly IS_READ_ONLY: false;
    /**
     * Performs arbitrary bitfield integer operations on strings
     * @param parser - The Redis command parser
     * @param key - The key holding the string
     * @param operations - Array of bitfield operations to perform: GET, SET, INCRBY or OVERFLOW
     */
    readonly parseCommand: (this: void, parser: CommandParser, key: RedisArgument, operations: BitFieldOperations) => void;
    readonly transformReply: () => ArrayReply<NumberReply | NullReply>;
};
export default _default;
//# sourceMappingURL=BITFIELD.d.ts.map