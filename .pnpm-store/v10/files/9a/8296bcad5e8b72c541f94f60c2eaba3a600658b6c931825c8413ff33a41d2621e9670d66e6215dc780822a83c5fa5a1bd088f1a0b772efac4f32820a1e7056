import { Reader } from '@jsonjoy.com/buffers/lib/Reader';
import { XdrDecoder } from '../../../xdr/XdrDecoder';
import { MountProc } from './constants';
import * as msg from './messages';
export declare class MountDecoder {
    protected readonly xdr: XdrDecoder;
    constructor(reader?: Reader);
    decodeMessage(reader: Reader, proc: MountProc, isRequest: boolean): msg.MountMessage | undefined;
    private decodeRequest;
    private decodeResponse;
    private readFhandle3;
    private readDirpath;
    private readMountBody;
    private readGroupNode;
    private readExportNode;
    private decodeMntRequest;
    private decodeMntResponse;
    private decodeDumpResponse;
    private decodeUmntRequest;
    private decodeExportResponse;
}
