"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RpcMessageEncoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const constants_1 = require("./constants");
const errors_1 = require("./errors");
const messages_1 = require("./messages");
class RpcMessageEncoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
    }
    encodeCall(xid, prog, vers, proc, cred, verf, params) {
        this.writeCall(xid, prog, vers, proc, cred, verf, params);
        return this.writer.flush();
    }
    encodeAcceptedReply(xid, verf, acceptStat, mismatchInfo, results) {
        this.writeAcceptedReply(xid, verf, acceptStat, mismatchInfo, results);
        return this.writer.flush();
    }
    encodeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        this.writeRejectedReply(xid, rejectStat, mismatchInfo, authStat);
        return this.writer.flush();
    }
    encodeMessage(msg) {
        this.writeMessage(msg);
        return this.writer.flush();
    }
    writeMessage(msg) {
        if (msg instanceof messages_1.RpcCallMessage) {
            this.writeCall(msg.xid, msg.prog, msg.vers, msg.proc, msg.cred, msg.verf, msg.params);
        }
        else if (msg instanceof messages_1.RpcAcceptedReplyMessage) {
            this.writeAcceptedReply(msg.xid, msg.verf, msg.stat, msg.mismatchInfo, msg.results);
        }
        else if (msg instanceof messages_1.RpcRejectedReplyMessage) {
            this.writeRejectedReply(msg.xid, msg.stat, msg.mismatchInfo, msg.authStat);
        }
    }
    writeCall(xid, prog, vers, proc, cred, verf, params) {
        const writer = this.writer;
        writer.ensureCapacity(16 * 4);
        const view = writer.view;
        let x = writer.x;
        view.setUint32(x, xid, false);
        x += 4;
        view.setUint32(x, 0, false);
        x += 4;
        view.setUint32(x, constants_1.RPC_VERSION, false);
        x += 4;
        view.setUint32(x, prog, false);
        x += 4;
        view.setUint32(x, vers, false);
        x += 4;
        view.setUint32(x, proc, false);
        x += 4;
        writer.x = x;
        this.writeOpaqueAuth(cred);
        this.writeOpaqueAuth(verf);
        if (params instanceof Uint8Array) {
            if (params.length > 0)
                writer.buf(params, params.length);
        }
        else if (params instanceof Reader_1.Reader) {
            const size = params.size();
            if (size > 0)
                writer.buf(params.subarray(0, size), size);
        }
    }
    writeAcceptedReply(xid, verf, acceptStat, mismatchInfo, results) {
        const writer = this.writer;
        writer.ensureCapacity(16 * 4);
        const view = writer.view;
        let x = writer.x;
        view.setUint32(x, xid, false);
        x += 4;
        view.setUint32(x, 1, false);
        x += 4;
        view.setUint32(x, 0, false);
        x += 4;
        writer.x = x;
        this.writeOpaqueAuth(verf);
        writer.u32(acceptStat);
        if (mismatchInfo) {
            writer.u32(mismatchInfo.low);
            writer.u32(mismatchInfo.high);
        }
        if (results) {
            if (results instanceof Uint8Array) {
                if (results.length > 0)
                    writer.buf(results, results.length);
            }
            else {
                const size = results.size();
                if (size > 0)
                    writer.buf(results.uint8, size);
            }
        }
    }
    writeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        const writer = this.writer;
        writer.ensureCapacity(7 * 4);
        const view = writer.view;
        let x = writer.x;
        view.setUint32(x, xid, false);
        x += 4;
        view.setUint32(x, 1, false);
        x += 4;
        view.setUint32(x, 1, false);
        x += 4;
        view.setUint32(x, rejectStat, false);
        x += 4;
        if (mismatchInfo) {
            view.setUint32(x, mismatchInfo.low, false);
            x += 4;
            view.setUint32(x, mismatchInfo.high, false);
            x += 4;
        }
        if (authStat !== undefined) {
            view.setUint32(x, authStat, false);
            x += 4;
        }
        writer.x = x;
    }
    writeOpaqueAuth(auth) {
        const writer = this.writer;
        const body = auth.body;
        const length = body.size();
        if (length > 400)
            throw new errors_1.RpcEncodingError('Auth body too large');
        writer.ensureCapacity(2 * 4 + length + 3);
        const view = writer.view;
        let x = writer.x;
        view.setUint32(x, auth.flavor, false);
        x += 4;
        view.setUint32(x, length, false);
        x += 4;
        if (length > 0) {
            writer.x = x;
            writer.buf(body.subarray(0, length), length);
            x = writer.x;
            const padding = (4 - (length % 4)) % 4;
            for (let i = 0; i < padding; i++) {
                view.setUint8(x, 0);
                x += 1;
            }
        }
        writer.x = x;
    }
}
exports.RpcMessageEncoder = RpcMessageEncoder;
//# sourceMappingURL=RpcMessageEncoder.js.map