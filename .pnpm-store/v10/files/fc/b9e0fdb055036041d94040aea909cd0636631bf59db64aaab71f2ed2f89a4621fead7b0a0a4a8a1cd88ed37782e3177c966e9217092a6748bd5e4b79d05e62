"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcRejectedReplyMessage = exports.RpcAcceptedReplyMessage = exports.RpcCallMessage = exports.RpcMismatchInfo = exports.RpcOpaqueAuth = void 0;
class RpcOpaqueAuth {
    constructor(flavor, body) {
        this.flavor = flavor;
        this.body = body;
    }
}
exports.RpcOpaqueAuth = RpcOpaqueAuth;
class RpcMismatchInfo {
    constructor(low, high) {
        this.low = low;
        this.high = high;
    }
}
exports.RpcMismatchInfo = RpcMismatchInfo;
class RpcCallMessage {
    constructor(xid, rpcvers, prog, vers, proc, cred, verf, params = undefined) {
        this.xid = xid;
        this.rpcvers = rpcvers;
        this.prog = prog;
        this.vers = vers;
        this.proc = proc;
        this.cred = cred;
        this.verf = verf;
        this.params = params;
    }
}
exports.RpcCallMessage = RpcCallMessage;
class RpcAcceptedReplyMessage {
    constructor(xid, verf, stat, mismatchInfo, results = undefined) {
        this.xid = xid;
        this.verf = verf;
        this.stat = stat;
        this.mismatchInfo = mismatchInfo;
        this.results = results;
    }
}
exports.RpcAcceptedReplyMessage = RpcAcceptedReplyMessage;
class RpcRejectedReplyMessage {
    constructor(xid, stat, mismatchInfo, authStat) {
        this.xid = xid;
        this.stat = stat;
        this.mismatchInfo = mismatchInfo;
        this.authStat = authStat;
    }
}
exports.RpcRejectedReplyMessage = RpcRejectedReplyMessage;
//# sourceMappingURL=messages.js.map