"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NlmDecoder = void 0;
const tslib_1 = require("tslib");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const XdrDecoder_1 = require("../../../xdr/XdrDecoder");
const errors_1 = require("../errors");
const msg = tslib_1.__importStar(require("./messages"));
const structs = tslib_1.__importStar(require("./structs"));
class NlmDecoder {
    constructor(reader = new Reader_1.Reader()) {
        this.xdr = new XdrDecoder_1.XdrDecoder(reader);
    }
    decodeMessage(reader, proc, isRequest) {
        this.xdr.reader = reader;
        const startPos = reader.x;
        try {
            if (isRequest) {
                return this.decodeRequest(proc);
            }
            else {
                return this.decodeResponse(proc);
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
    decodeRequest(proc) {
        switch (proc) {
            case 0:
                return undefined;
            case 1:
                return this.decodeTestRequest();
            case 2:
                return this.decodeLockRequest();
            case 3:
                return this.decodeCancelRequest();
            case 4:
                return this.decodeUnlockRequest();
            case 5:
                return this.decodeGrantedRequest();
            case 20:
                return this.decodeShareRequest();
            case 21:
                return this.decodeUnshareRequest();
            case 22:
                return this.decodeNmLockRequest();
            case 23:
                return this.decodeFreeAllRequest();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown NLM procedure: ${proc}`);
        }
    }
    decodeResponse(proc) {
        switch (proc) {
            case 0:
                return undefined;
            case 1:
                return this.decodeTestResponse();
            case 2:
            case 3:
            case 4:
            case 5:
            case 22:
                return this.decodeResponse4();
            case 20:
            case 21:
                return this.decodeShareResponse();
            default:
                throw new errors_1.Nfsv3DecodingError(`Unknown NLM procedure: ${proc}`);
        }
    }
    readCookie() {
        const data = this.xdr.readVarlenOpaque();
        return new Reader_1.Reader(data);
    }
    readNetobj() {
        const data = this.xdr.readVarlenOpaque();
        return new Reader_1.Reader(data);
    }
    readNlm4Holder() {
        const xdr = this.xdr;
        const exclusive = xdr.readBoolean();
        const svid = xdr.readInt();
        const oh = this.readNetobj();
        const offset = xdr.readUnsignedHyper();
        const length = xdr.readUnsignedHyper();
        return new structs.Nlm4Holder(exclusive, svid, oh, offset, length);
    }
    readNlm4Lock() {
        const xdr = this.xdr;
        const callerName = xdr.readString();
        const fh = this.readNetobj();
        const oh = this.readNetobj();
        const svid = xdr.readInt();
        const offset = xdr.readUnsignedHyper();
        const length = xdr.readUnsignedHyper();
        return new structs.Nlm4Lock(callerName, fh, oh, svid, offset, length);
    }
    readNlm4Share() {
        const xdr = this.xdr;
        const callerName = xdr.readString();
        const fh = this.readNetobj();
        const oh = this.readNetobj();
        const mode = xdr.readUnsignedInt();
        const access = xdr.readUnsignedInt();
        return new structs.Nlm4Share(callerName, fh, oh, mode, access);
    }
    readTestArgs() {
        const cookie = this.readCookie();
        const exclusive = this.xdr.readBoolean();
        const lock = this.readNlm4Lock();
        return new msg.Nlm4TestArgs(cookie, exclusive, lock);
    }
    readLockArgs() {
        const xdr = this.xdr;
        const cookie = this.readCookie();
        const block = xdr.readBoolean();
        const exclusive = xdr.readBoolean();
        const lock = this.readNlm4Lock();
        const reclaim = xdr.readBoolean();
        const state = xdr.readInt();
        return new msg.Nlm4LockArgs(cookie, block, exclusive, lock, reclaim, state);
    }
    readCancelArgs() {
        const xdr = this.xdr;
        const cookie = this.readCookie();
        const block = xdr.readBoolean();
        const exclusive = xdr.readBoolean();
        const lock = this.readNlm4Lock();
        return new msg.Nlm4CancelArgs(cookie, block, exclusive, lock);
    }
    readUnlockArgs() {
        const cookie = this.readCookie();
        const lock = this.readNlm4Lock();
        return new msg.Nlm4UnlockArgs(cookie, lock);
    }
    readShareArgs() {
        const cookie = this.readCookie();
        const share = this.readNlm4Share();
        const reclaim = this.xdr.readBoolean();
        return new msg.Nlm4ShareArgs(cookie, share, reclaim);
    }
    decodeTestRequest() {
        const args = this.readTestArgs();
        return new msg.Nlm4TestRequest(args);
    }
    decodeTestResponse() {
        const xdr = this.xdr;
        const cookie = this.readCookie();
        const stat = xdr.readUnsignedInt();
        const holder = stat === 1 ? this.readNlm4Holder() : undefined;
        return new msg.Nlm4TestResponse(cookie, stat, holder);
    }
    decodeLockRequest() {
        const args = this.readLockArgs();
        return new msg.Nlm4LockRequest(args);
    }
    decodeResponse4() {
        const cookie = this.readCookie();
        const stat = this.xdr.readUnsignedInt();
        return new msg.Nlm4Response(cookie, stat);
    }
    decodeCancelRequest() {
        const args = this.readCancelArgs();
        return new msg.Nlm4CancelRequest(args);
    }
    decodeUnlockRequest() {
        const args = this.readUnlockArgs();
        return new msg.Nlm4UnlockRequest(args);
    }
    decodeGrantedRequest() {
        const args = this.readTestArgs();
        return new msg.Nlm4GrantedRequest(args);
    }
    decodeShareRequest() {
        const args = this.readShareArgs();
        return new msg.Nlm4ShareRequest(args);
    }
    decodeShareResponse() {
        const xdr = this.xdr;
        const cookie = this.readCookie();
        const stat = xdr.readUnsignedInt();
        const sequence = xdr.readInt();
        return new msg.Nlm4ShareResponse(cookie, stat, sequence);
    }
    decodeUnshareRequest() {
        const args = this.readShareArgs();
        return new msg.Nlm4UnshareRequest(args);
    }
    decodeNmLockRequest() {
        const args = this.readLockArgs();
        return new msg.Nlm4NmLockRequest(args);
    }
    decodeFreeAllRequest() {
        const xdr = this.xdr;
        const name = xdr.readString();
        const state = xdr.readInt();
        const notify = new structs.Nlm4Notify(name, state);
        return new msg.Nlm4FreeAllRequest(notify);
    }
}
exports.NlmDecoder = NlmDecoder;
//# sourceMappingURL=NlmDecoder.js.map