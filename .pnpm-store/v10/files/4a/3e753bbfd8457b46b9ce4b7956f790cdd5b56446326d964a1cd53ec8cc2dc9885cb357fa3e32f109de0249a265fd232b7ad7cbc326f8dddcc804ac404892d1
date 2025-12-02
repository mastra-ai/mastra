"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4FullEncoder = void 0;
const Writer_1 = require("@jsonjoy.com/buffers/lib/Writer");
const Nfsv4Encoder_1 = require("./Nfsv4Encoder");
const RpcMessageEncoder_1 = require("../../rpc/RpcMessageEncoder");
const RmRecordEncoder_1 = require("../../rm/RmRecordEncoder");
class Nfsv4FullEncoder {
    constructor(writer = new Writer_1.Writer()) {
        this.writer = writer;
        this.nfsEncoder = new Nfsv4Encoder_1.Nfsv4Encoder(writer);
        this.rpcEncoder = new RpcMessageEncoder_1.RpcMessageEncoder(writer);
        this.rmEncoder = new RmRecordEncoder_1.RmRecordEncoder(writer);
        this.xdr = this.nfsEncoder.xdr;
    }
    encodeCall(xid, proc, cred, verf, request) {
        this.writeCall(xid, proc, cred, verf, request);
        return this.writer.flush();
    }
    writeCall(xid, proc, cred, verf, request) {
        const rm = this.rmEncoder;
        const state = rm.startRecord();
        this.rpcEncoder.writeCall(xid, 100003, 4, proc, cred, verf);
        this.nfsEncoder.writeCompound(request, true);
        rm.endRecord(state);
    }
    encodeAcceptedCompoundReply(xid, proc, verf, response) {
        this.writeAcceptedCompoundReply(xid, verf, response);
        return this.writer.flush();
    }
    writeAcceptedCompoundReply(xid, verf, compound) {
        const rm = this.rmEncoder;
        const state = rm.startRecord();
        this.rpcEncoder.writeAcceptedReply(xid, verf, 0);
        compound.encode(this.xdr);
        rm.endRecord(state);
    }
    encodeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        this.writeRejectedReply(xid, rejectStat, mismatchInfo, authStat);
        return this.writer.flush();
    }
    writeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        const rm = this.rmEncoder;
        const state = rm.startRecord();
        this.rpcEncoder.writeRejectedReply(xid, rejectStat, mismatchInfo, authStat);
        rm.endRecord(state);
    }
    encodeCbCall(xid, cbProgram, proc, cred, verf, request) {
        this.writeCbCall(xid, cbProgram, proc, cred, verf, request);
        return this.writer.flush();
    }
    writeCbCall(xid, cbProgram, proc, cred, verf, request) {
        const rm = this.rmEncoder;
        const state = rm.startRecord();
        this.rpcEncoder.writeCall(xid, cbProgram, 4, proc, cred, verf);
        this.nfsEncoder.writeCbCompound(request, true);
        rm.endRecord(state);
    }
    encodeCbAcceptedReply(xid, proc, verf, response) {
        this.writeCbAcceptedReply(xid, proc, verf, response);
        return this.writer.flush();
    }
    writeCbAcceptedReply(xid, proc, verf, response) {
        const rm = this.rmEncoder;
        const state = rm.startRecord();
        this.rpcEncoder.writeAcceptedReply(xid, verf, 0);
        this.nfsEncoder.writeCbCompound(response, false);
        rm.endRecord(state);
    }
}
exports.Nfsv4FullEncoder = Nfsv4FullEncoder;
//# sourceMappingURL=Nfsv4FullEncoder.js.map