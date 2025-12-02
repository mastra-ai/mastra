import { Reader } from '@jsonjoy.com/buffers/lib/Reader';
import { RpcOpaqueAuth, RpcMessage } from './messages';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class RpcMessageEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    constructor(writer?: W);
    encodeCall(xid: number, prog: number, vers: number, proc: number, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, params?: Reader | Uint8Array): Uint8Array;
    encodeAcceptedReply(xid: number, verf: RpcOpaqueAuth, acceptStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, results?: Reader | Uint8Array): Uint8Array;
    encodeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): Uint8Array;
    encodeMessage(msg: RpcMessage): Uint8Array;
    writeMessage(msg: RpcMessage): void;
    writeCall(xid: number, prog: number, vers: number, proc: number, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, params?: Reader | Uint8Array): void;
    writeAcceptedReply(xid: number, verf: RpcOpaqueAuth, acceptStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, results?: Reader | Uint8Array): void;
    writeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): void;
    private writeOpaqueAuth;
}
