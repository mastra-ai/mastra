"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullNfsv3Encoder = void 0;
const Writer_1 = require("@jsonjoy.com/util/lib/buffers/Writer");
const Nfsv3Encoder_1 = require("./Nfsv3Encoder");
const RpcMessageEncoder_1 = require("../../rpc/RpcMessageEncoder");
const RmRecordEncoder_1 = require("../../rm/RmRecordEncoder");
const MAX_SINGLE_FRAME_SIZE = 0x7fffffff;
const RM_HEADER_SIZE = 4;
class FullNfsv3Encoder {
    constructor(program = 100003, writer = new Writer_1.Writer()) {
        this.program = program;
        this.writer = writer;
        this.nfsEncoder = new Nfsv3Encoder_1.Nfsv3Encoder(writer);
        this.rpcEncoder = new RpcMessageEncoder_1.RpcMessageEncoder(writer);
        this.rmEncoder = new RmRecordEncoder_1.RmRecordEncoder(writer);
    }
    encodeCall(xid, proc, cred, verf, request) {
        this.writeCall(xid, proc, cred, verf, request);
        return this.writer.flush();
    }
    writeCall(xid, proc, cred, verf, request) {
        const writer = this.writer;
        const rmHeaderPosition = writer.x;
        writer.x += RM_HEADER_SIZE;
        this.rpcEncoder.writeCall(xid, 100003, 3, proc, cred, verf);
        this.nfsEncoder.writeMessage(request, proc, true);
        this.writeRmHeader(rmHeaderPosition, writer.x);
    }
    encodeAcceptedReply(xid, proc, verf, response) {
        this.writeAcceptedReply(xid, proc, verf, response);
        return this.writer.flush();
    }
    writeAcceptedReply(xid, proc, verf, response) {
        const writer = this.writer;
        const rmHeaderPosition = writer.x;
        writer.x += RM_HEADER_SIZE;
        this.rpcEncoder.writeAcceptedReply(xid, verf, 0);
        this.nfsEncoder.writeMessage(response, proc, false);
        this.writeRmHeader(rmHeaderPosition, writer.x);
    }
    encodeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        this.writeRejectedReply(xid, rejectStat, mismatchInfo, authStat);
        return this.writer.flush();
    }
    writeRejectedReply(xid, rejectStat, mismatchInfo, authStat) {
        const writer = this.writer;
        const rmHeaderPosition = writer.x;
        writer.x += RM_HEADER_SIZE;
        this.rpcEncoder.writeRejectedReply(xid, rejectStat, mismatchInfo, authStat);
        this.writeRmHeader(rmHeaderPosition, writer.x);
    }
    writeRmHeader(rmHeaderPosition, endPosition) {
        const writer = this.writer;
        const rmEncoder = this.rmEncoder;
        const totalSize = endPosition - rmHeaderPosition - RM_HEADER_SIZE;
        if (totalSize <= MAX_SINGLE_FRAME_SIZE) {
            const currentX = writer.x;
            writer.x = rmHeaderPosition;
            rmEncoder.writeHdr(1, totalSize);
            writer.x = currentX;
        }
        else {
            const currentX = writer.x;
            writer.x = rmHeaderPosition;
            const data = writer.uint8.subarray(rmHeaderPosition + RM_HEADER_SIZE, currentX);
            writer.reset();
            rmEncoder.writeRecord(data);
        }
    }
}
exports.FullNfsv3Encoder = FullNfsv3Encoder;
//# sourceMappingURL=FullNfsv3Encoder.js.map