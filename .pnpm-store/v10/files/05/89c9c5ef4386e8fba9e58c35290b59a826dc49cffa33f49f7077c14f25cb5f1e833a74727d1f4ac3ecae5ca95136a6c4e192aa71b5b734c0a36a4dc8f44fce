import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class RmRecordEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    constructor(writer?: W);
    encodeHdr(fin: 0 | 1, length: number): Uint8Array;
    encodeRecord(record: Uint8Array): Uint8Array;
    writeHdr(fin: 0 | 1, length: number): void;
    writeRecord(record: Uint8Array): void;
    writeFragment(record: Uint8Array, offset: number, length: number, fin: 0 | 1): void;
    startRecord(): number;
    endRecord(rmHeaderPosition: number): void;
}
