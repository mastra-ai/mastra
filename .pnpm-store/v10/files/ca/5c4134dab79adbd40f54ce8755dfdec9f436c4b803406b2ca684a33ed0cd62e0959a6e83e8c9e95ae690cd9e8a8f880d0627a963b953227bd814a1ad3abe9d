import { Nfsv3Encoder } from './Nfsv3Encoder';
import { RpcMessageEncoder } from '../../rpc/RpcMessageEncoder';
import { RmRecordEncoder } from '../../rm/RmRecordEncoder';
import { Nfsv3Proc } from './constants';
import { RpcOpaqueAuth } from '../../rpc/messages';
import type * as msg from './messages';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class FullNfsv3Encoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    program: number;
    readonly writer: W;
    protected readonly nfsEncoder: Nfsv3Encoder<W>;
    protected readonly rpcEncoder: RpcMessageEncoder<W>;
    protected readonly rmEncoder: RmRecordEncoder<W>;
    constructor(program?: number, writer?: W);
    encodeCall(xid: number, proc: Nfsv3Proc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv3Request): Uint8Array;
    writeCall(xid: number, proc: Nfsv3Proc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv3Request): void;
    encodeAcceptedReply(xid: number, proc: Nfsv3Proc, verf: RpcOpaqueAuth, response: msg.Nfsv3Response): Uint8Array;
    writeAcceptedReply(xid: number, proc: Nfsv3Proc, verf: RpcOpaqueAuth, response: msg.Nfsv3Response): void;
    encodeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): Uint8Array;
    writeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): void;
    private writeRmHeader;
}
