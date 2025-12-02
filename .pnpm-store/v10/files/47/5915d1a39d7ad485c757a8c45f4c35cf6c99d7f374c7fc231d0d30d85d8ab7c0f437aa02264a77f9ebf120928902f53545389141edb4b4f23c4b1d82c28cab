import { type Parameter } from './data-type';
import { type InternalConnectionOptions } from './connection';
import { Collation } from './collation';
declare class RpcRequestPayload implements Iterable<Buffer> {
    procedure: string | number;
    parameters: Parameter[];
    options: InternalConnectionOptions;
    txnDescriptor: Buffer;
    collation: Collation | undefined;
    constructor(procedure: string | number, parameters: Parameter[], txnDescriptor: Buffer, options: InternalConnectionOptions, collation: Collation | undefined);
    [Symbol.iterator](): Generator<Buffer, void, unknown>;
    generateData(): Generator<Buffer, void, unknown>;
    toString(indent?: string): string;
    generateParameterData(parameter: Parameter): Generator<Buffer, void, unknown>;
}
export default RpcRequestPayload;
