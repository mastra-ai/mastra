"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcMessageDecoder = void 0;
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const errors_1 = require("./errors");
const messages_1 = require("./messages");
const EMPTY_BUFFER = new Uint8Array(0);
const EMPTY_READER = new Reader_1.Reader(EMPTY_BUFFER);
class RpcMessageDecoder {
    decodeMessage(reader) {
        const startPos = reader.x;
        try {
            if (reader.size() < 8)
                return undefined;
            const xid = reader.u32();
            const msgType = reader.u32();
            if (msgType === 0) {
                if (reader.size() < 20)
                    return (reader.x = startPos), undefined;
                const rpcvers = reader.u32();
                const prog = reader.u32();
                const vers = reader.u32();
                const proc = reader.u32();
                const cred = this.readOpaqueAuth(reader);
                if (!cred)
                    return (reader.x = startPos), undefined;
                const verf = this.readOpaqueAuth(reader);
                if (!verf)
                    return (reader.x = startPos), undefined;
                const params = reader.size() > 0 ? reader.cut(reader.size()) : undefined;
                return new messages_1.RpcCallMessage(xid, rpcvers, prog, vers, proc, cred, verf, params);
            }
            else if (msgType === 1) {
                if (reader.size() < 4)
                    return (reader.x = startPos), undefined;
                const replyStat = reader.u32();
                if (replyStat === 0) {
                    const verf = this.readOpaqueAuth(reader);
                    if (!verf || reader.size() < 4)
                        return (reader.x = startPos), undefined;
                    const acceptStat = reader.u32();
                    let mismatchInfo;
                    if (acceptStat === 2) {
                        if (reader.size() < 8)
                            return (reader.x = startPos), undefined;
                        const low = reader.u32();
                        const high = reader.u32();
                        mismatchInfo = new messages_1.RpcMismatchInfo(low, high);
                    }
                    const results = reader.size() > 0 ? reader.cut(reader.size()) : undefined;
                    return new messages_1.RpcAcceptedReplyMessage(xid, verf, acceptStat, mismatchInfo, results);
                }
                else if (replyStat === 1) {
                    if (reader.size() < 4)
                        return (reader.x = startPos), undefined;
                    const rejectStat = reader.u32();
                    let mismatchInfo;
                    let authStat;
                    if (rejectStat === 0) {
                        if (reader.size() < 8)
                            return (reader.x = startPos), undefined;
                        const low = reader.u32();
                        const high = reader.u32();
                        mismatchInfo = new messages_1.RpcMismatchInfo(low, high);
                        if (!mismatchInfo)
                            return (reader.x = startPos), undefined;
                    }
                    else if (rejectStat === 1) {
                        if (reader.size() < 4)
                            return (reader.x = startPos), undefined;
                        authStat = reader.u32();
                    }
                    return new messages_1.RpcRejectedReplyMessage(xid, rejectStat, mismatchInfo, authStat);
                }
                else {
                    throw new errors_1.RpcDecodingError('Invalid reply_stat');
                }
            }
            else {
                throw new errors_1.RpcDecodingError('Invalid msg_type');
            }
        }
        catch (err) {
            if (err instanceof RangeError) {
                reader.x = startPos;
                return undefined;
            }
            throw err;
        }
    }
    readOpaqueAuth(reader) {
        if (reader.size() < 8)
            return undefined;
        const flavor = reader.u32();
        const length = reader.u32();
        if (length > 400)
            throw new errors_1.RpcDecodingError('Auth body too large');
        const paddedLength = (length + 3) & ~3;
        if (reader.size() < paddedLength)
            return undefined;
        const body = length > 0 ? reader.cut(length) : EMPTY_READER;
        const padding = paddedLength - length;
        if (padding > 0)
            reader.skip(padding);
        return new messages_1.RpcOpaqueAuth(flavor, body);
    }
}
exports.RpcMessageDecoder = RpcMessageDecoder;
//# sourceMappingURL=RpcMessageDecoder.js.map