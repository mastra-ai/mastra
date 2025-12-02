import { Nfsv4Encoder } from './Nfsv4Encoder';
import { RpcMessageEncoder } from '../../rpc/RpcMessageEncoder';
import { RmRecordEncoder } from '../../rm/RmRecordEncoder';
import { Nfsv4Proc, Nfsv4CbProc } from './constants';
import { RpcOpaqueAuth } from '../../rpc/messages';
import { XdrEncoder } from '../../xdr';
import type * as msg from './messages';
import type { IWriter, IWriterGrowable } from '@jsonjoy.com/util/lib/buffers';
export declare class Nfsv4FullEncoder<W extends IWriter & IWriterGrowable = IWriter & IWriterGrowable> {
    readonly writer: W;
    readonly nfsEncoder: Nfsv4Encoder<W>;
    readonly rpcEncoder: RpcMessageEncoder<W>;
    readonly rmEncoder: RmRecordEncoder<W>;
    readonly xdr: XdrEncoder;
    constructor(writer?: W);
    encodeCall(xid: number, proc: Nfsv4Proc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv4CompoundRequest): Uint8Array;
    writeCall(xid: number, proc: Nfsv4Proc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv4CompoundRequest): void;
    encodeAcceptedCompoundReply(xid: number, proc: Nfsv4Proc, verf: RpcOpaqueAuth, response: msg.Nfsv4CompoundResponse): Uint8Array;
    writeAcceptedCompoundReply(xid: number, verf: RpcOpaqueAuth, compound: msg.Nfsv4CompoundResponse): void;
    encodeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): Uint8Array;
    writeRejectedReply(xid: number, rejectStat: number, mismatchInfo?: {
        low: number;
        high: number;
    }, authStat?: number): void;
    encodeCbCall(xid: number, cbProgram: number, proc: Nfsv4CbProc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv4CbCompoundRequest): Uint8Array;
    writeCbCall(xid: number, cbProgram: number, proc: Nfsv4CbProc, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, request: msg.Nfsv4CbCompoundRequest): void;
    encodeCbAcceptedReply(xid: number, proc: Nfsv4CbProc, verf: RpcOpaqueAuth, response: msg.Nfsv4CbCompoundResponse): Uint8Array;
    writeCbAcceptedReply(xid: number, proc: Nfsv4CbProc, verf: RpcOpaqueAuth, response: msg.Nfsv4CbCompoundResponse): void;
}
