import { JsonPackMpint } from '../JsonPackMpint';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/buffers/lib';
import type { BinaryJsonEncoder } from '../types';
export declare class SshEncoder implements BinaryJsonEncoder {
    readonly writer: IWriter & IWriterGrowable;
    constructor(writer: IWriter & IWriterGrowable);
    encode(value: unknown): Uint8Array;
    writeUnknown(value: unknown): void;
    writeAny(value: unknown): void;
    writeNull(): void;
    writeBoolean(bool: boolean): void;
    writeByte(byte: number): void;
    writeUint32(uint: number): void;
    writeUint64(uint: number | bigint): void;
    writeBinStr(data: Uint8Array): void;
    writeStr(str: string): void;
    writeAsciiStr(str: string): void;
    writeMpint(mpint: JsonPackMpint): void;
    writeNameList(names: string[]): void;
    writeNumber(num: number): void;
    writeInteger(int: number): void;
    writeUInteger(uint: number): void;
    writeFloat(float: number): void;
    writeBin(buf: Uint8Array): void;
    writeArr(arr: unknown[]): void;
    writeObj(obj: Record<string, unknown>): void;
}
