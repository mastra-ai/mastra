import type { Reader } from '@jsonjoy.com/buffers/lib/Reader';
import type { RpcAuthFlavor, RpcAcceptStat, RpcRejectStat, RpcAuthStat } from './constants';
export { RpcMsgType, RpcReplyStat, RpcAcceptStat, RpcRejectStat, RpcAuthStat, RpcAuthFlavor } from './constants';
export declare class RpcOpaqueAuth {
    readonly flavor: RpcAuthFlavor;
    readonly body: Reader;
    constructor(flavor: RpcAuthFlavor, body: Reader);
}
export declare class RpcMismatchInfo {
    readonly low: number;
    readonly high: number;
    constructor(low: number, high: number);
}
export declare class RpcCallMessage {
    readonly xid: number;
    readonly rpcvers: number;
    readonly prog: number;
    readonly vers: number;
    readonly proc: number;
    readonly cred: RpcOpaqueAuth;
    readonly verf: RpcOpaqueAuth;
    params: Reader | undefined;
    constructor(xid: number, rpcvers: number, prog: number, vers: number, proc: number, cred: RpcOpaqueAuth, verf: RpcOpaqueAuth, params?: Reader | undefined);
}
export declare class RpcAcceptedReplyMessage {
    readonly xid: number;
    readonly verf: RpcOpaqueAuth;
    readonly stat: RpcAcceptStat;
    readonly mismatchInfo?: RpcMismatchInfo | undefined;
    results: Reader | undefined;
    constructor(xid: number, verf: RpcOpaqueAuth, stat: RpcAcceptStat, mismatchInfo?: RpcMismatchInfo | undefined, results?: Reader | undefined);
}
export declare class RpcRejectedReplyMessage {
    readonly xid: number;
    readonly stat: RpcRejectStat;
    readonly mismatchInfo?: RpcMismatchInfo | undefined;
    readonly authStat?: RpcAuthStat | undefined;
    constructor(xid: number, stat: RpcRejectStat, mismatchInfo?: RpcMismatchInfo | undefined, authStat?: RpcAuthStat | undefined);
}
export type RpcMessage = RpcCallMessage | RpcAcceptedReplyMessage | RpcRejectedReplyMessage;
