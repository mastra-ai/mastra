"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NlmEncoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const XdrEncoder_1 = require("../../../xdr/XdrEncoder");
const errors_1 = require("../errors");
class NlmEncoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
        this.xdr = new XdrEncoder_1.XdrEncoder(writer);
    }
    encodeMessage(message, proc, isRequest) {
        if (isRequest)
            this.writeRequest(message, proc);
        else
            this.writeResponse(message, proc);
        return this.writer.flush();
    }
    writeMessage(message, proc, isRequest) {
        if (isRequest)
            this.writeRequest(message, proc);
        else
            this.writeResponse(message, proc);
    }
    writeRequest(request, proc) {
        switch (proc) {
            case 0:
                return;
            case 1:
                return this.writeTestRequest(request);
            case 2:
                return this.writeLockRequest(request);
            case 3:
                return this.writeCancelRequest(request);
            case 4:
                return this.writeUnlockRequest(request);
            case 5:
                return this.writeGrantedRequest(request);
            case 20:
                return this.writeShareRequest(request);
            case 21:
                return this.writeUnshareRequest(request);
            case 22:
                return this.writeNmLockRequest(request);
            case 23:
                return this.writeFreeAllRequest(request);
            default:
                throw new errors_1.Nfsv3EncodingError(`Unknown NLM procedure: ${proc}`);
        }
    }
    writeResponse(response, proc) {
        switch (proc) {
            case 0:
                return;
            case 1:
                return this.writeTestResponse(response);
            case 2:
            case 3:
            case 4:
            case 5:
            case 22:
                return this.writeResponse4(response);
            case 20:
            case 21:
                return this.writeShareResponse(response);
            default:
                throw new errors_1.Nfsv3EncodingError(`Unknown NLM procedure: ${proc}`);
        }
    }
    writeCookie(cookie) {
        const data = cookie.uint8;
        this.xdr.writeVarlenOpaque(data);
    }
    writeNetobj(obj) {
        const data = obj.uint8;
        this.xdr.writeVarlenOpaque(data);
    }
    writeNlm4Holder(holder) {
        const xdr = this.xdr;
        xdr.writeBoolean(holder.exclusive);
        xdr.writeInt(holder.svid);
        this.writeNetobj(holder.oh);
        xdr.writeUnsignedHyper(holder.offset);
        xdr.writeUnsignedHyper(holder.length);
    }
    writeNlm4Lock(lock) {
        const xdr = this.xdr;
        xdr.writeStr(lock.callerName);
        this.writeNetobj(lock.fh);
        this.writeNetobj(lock.oh);
        xdr.writeInt(lock.svid);
        xdr.writeUnsignedHyper(lock.offset);
        xdr.writeUnsignedHyper(lock.length);
    }
    writeNlm4Share(share) {
        const xdr = this.xdr;
        xdr.writeStr(share.callerName);
        this.writeNetobj(share.fh);
        this.writeNetobj(share.oh);
        xdr.writeUnsignedInt(share.mode);
        xdr.writeUnsignedInt(share.access);
    }
    writeTestArgs(args) {
        this.writeCookie(args.cookie);
        this.xdr.writeBoolean(args.exclusive);
        this.writeNlm4Lock(args.lock);
    }
    writeLockArgs(args) {
        const xdr = this.xdr;
        this.writeCookie(args.cookie);
        xdr.writeBoolean(args.block);
        xdr.writeBoolean(args.exclusive);
        this.writeNlm4Lock(args.lock);
        xdr.writeBoolean(args.reclaim);
        xdr.writeInt(args.state);
    }
    writeCancelArgs(args) {
        const xdr = this.xdr;
        this.writeCookie(args.cookie);
        xdr.writeBoolean(args.block);
        xdr.writeBoolean(args.exclusive);
        this.writeNlm4Lock(args.lock);
    }
    writeUnlockArgs(args) {
        this.writeCookie(args.cookie);
        this.writeNlm4Lock(args.lock);
    }
    writeShareArgs(args) {
        this.writeCookie(args.cookie);
        this.writeNlm4Share(args.share);
        this.xdr.writeBoolean(args.reclaim);
    }
    writeTestRequest(req) {
        this.writeTestArgs(req.args);
    }
    writeTestResponse(res) {
        const xdr = this.xdr;
        this.writeCookie(res.cookie);
        xdr.writeUnsignedInt(res.stat);
        if (res.stat === 1 && res.holder) {
            this.writeNlm4Holder(res.holder);
        }
    }
    writeLockRequest(req) {
        this.writeLockArgs(req.args);
    }
    writeResponse4(res) {
        this.writeCookie(res.cookie);
        this.xdr.writeUnsignedInt(res.stat);
    }
    writeCancelRequest(req) {
        this.writeCancelArgs(req.args);
    }
    writeUnlockRequest(req) {
        this.writeUnlockArgs(req.args);
    }
    writeGrantedRequest(req) {
        this.writeTestArgs(req.args);
    }
    writeShareRequest(req) {
        this.writeShareArgs(req.args);
    }
    writeShareResponse(res) {
        const xdr = this.xdr;
        this.writeCookie(res.cookie);
        xdr.writeUnsignedInt(res.stat);
        xdr.writeInt(res.sequence);
    }
    writeUnshareRequest(req) {
        this.writeShareArgs(req.args);
    }
    writeNmLockRequest(req) {
        this.writeLockArgs(req.args);
    }
    writeFreeAllRequest(req) {
        const xdr = this.xdr;
        xdr.writeStr(req.notify.name);
        xdr.writeInt(req.notify.state);
    }
}
exports.NlmEncoder = NlmEncoder;
//# sourceMappingURL=NlmEncoder.js.map