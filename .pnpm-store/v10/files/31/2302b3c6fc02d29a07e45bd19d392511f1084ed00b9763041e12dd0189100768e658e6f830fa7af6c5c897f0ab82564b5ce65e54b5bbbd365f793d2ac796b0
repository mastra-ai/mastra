import { JsonPackMpint } from '../JsonPackMpint';
import type { IReader, IReaderResettable } from '@jsonjoy.com/buffers/lib';
import type { BinaryJsonDecoder } from '../types';
export declare class SshDecoder<R extends IReader & IReaderResettable = IReader & IReaderResettable> implements BinaryJsonDecoder {
    reader: R;
    constructor(reader?: R);
    read(uint8: Uint8Array): unknown;
    decode(uint8: Uint8Array): unknown;
    readAny(): unknown;
    readBoolean(): boolean;
    readByte(): number;
    readUint32(): number;
    readUint64(): bigint;
    readBinStr(): Uint8Array;
    readStr(): string;
    readAsciiStr(): string;
    readMpint(): JsonPackMpint;
    readNameList(): string[];
    readBin(): Uint8Array;
}
