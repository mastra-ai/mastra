import { XdrEncoder } from '../../../xdr/XdrEncoder';
import { MountProc } from './constants';
import * as msg from './messages';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class MountEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    protected readonly xdr: XdrEncoder;
    constructor(writer?: W);
    encodeMessage(message: msg.MountMessage, proc: MountProc, isRequest: boolean): Uint8Array;
    writeMessage(message: msg.MountMessage, proc: MountProc, isRequest: boolean): void;
    private writeRequest;
    private writeResponse;
    private writeFhandle3;
    private writeDirpath;
    private writeMountBody;
    private writeGroupNode;
    private writeExportNode;
    private writeMntRequest;
    private writeMntResponse;
    private writeDumpResponse;
    private writeUmntRequest;
    private writeExportResponse;
}
