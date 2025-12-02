"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4Connection = void 0;
const tslib_1 = require("tslib");
const Reader_1 = require("@jsonjoy.com/buffers/lib/Reader");
const Nfsv4Decoder_1 = require("../Nfsv4Decoder");
const Nfsv4FullEncoder_1 = require("../Nfsv4FullEncoder");
const rm_1 = require("../../../rm");
const rpc_1 = require("../../../rpc");
const msg = tslib_1.__importStar(require("../messages"));
const constants_1 = require("../constants");
const Nfsv4CompoundProcCtx_1 = require("./Nfsv4CompoundProcCtx");
const EMPTY_AUTH = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
class Nfsv4Connection {
    constructor(opts) {
        this.closed = false;
        this.maxIncomingMessage = 2 * 1024 * 1024;
        this.maxBackpressure = 2 * 1024 * 1024;
        this.lastXid = 0;
        this.__uncorkTimer = null;
        this.debug = !!opts.debug;
        this.logger = opts.logger || console;
        const duplex = (this.duplex = opts.duplex);
        this.ops = opts.ops;
        this.rmDecoder = new rm_1.RmRecordDecoder();
        this.rpcDecoder = new rpc_1.RpcMessageDecoder();
        this.nfsDecoder = new Nfsv4Decoder_1.Nfsv4Decoder();
        const nfsEncoder = (this.nfsEncoder = new Nfsv4FullEncoder_1.Nfsv4FullEncoder());
        this.writer = nfsEncoder.writer;
        this.rmEncoder = nfsEncoder.rmEncoder;
        this.rpcEncoder = nfsEncoder.rpcEncoder;
        duplex.on('data', this.onData.bind(this));
        duplex.on('timeout', () => this.close());
        duplex.on('close', (hadError) => {
            this.close();
        });
        duplex.on('error', (err) => {
            this.logger.error('SOCKET ERROR:', err);
            this.close();
        });
    }
    onData(data) {
        const { rmDecoder, rpcDecoder } = this;
        rmDecoder.push(data);
        let record = rmDecoder.readRecord();
        while (record) {
            if (record.size()) {
                const rpcMessage = rpcDecoder.decodeMessage(record);
                if (rpcMessage)
                    this.onRpcMessage(rpcMessage);
                else {
                    this.close();
                    return;
                }
            }
            record = rmDecoder.readRecord();
        }
    }
    onRpcMessage(msg) {
        if (msg instanceof rpc_1.RpcCallMessage) {
            this.lastXid = msg.xid;
            this.onRpcCallMessage(msg);
        }
        else if (msg instanceof rpc_1.RpcAcceptedReplyMessage) {
            throw new Error('Not implemented RpcAcceptedReplyMessage');
        }
        else if (msg instanceof rpc_1.RpcRejectedReplyMessage) {
            throw new Error('Not implemented RpcRejectedReplyMessage');
        }
    }
    onRpcCallMessage(procedure) {
        const { debug, logger, writer, rmEncoder } = this;
        const { xid, proc } = procedure;
        switch (proc) {
            case 1: {
                if (debug)
                    logger.log(`\n<COMPOUND{${xid}}>`);
                if (!(procedure.params instanceof Reader_1.Reader))
                    return;
                const compound = this.nfsDecoder.decodeCompoundRequest(procedure.params);
                if (compound instanceof msg.Nfsv4CompoundRequest) {
                    new Nfsv4CompoundProcCtx_1.Nfsv4CompoundProcCtx(this, compound)
                        .exec()
                        .then((procResponse) => {
                        if (debug)
                            logger.log(`</COMPOUND{${xid}}>`);
                        this.nfsEncoder.writeAcceptedCompoundReply(xid, EMPTY_AUTH, procResponse);
                        this.write(writer.flush());
                    })
                        .catch((err) => {
                        logger.error('NFS COMPOUND error:', xid, err);
                        this.nfsEncoder.writeRejectedReply(xid, 10006);
                    });
                }
                else
                    this.closeWithError(4);
                break;
            }
            case 0: {
                if (debug)
                    logger.log('NULL', procedure);
                const state = rmEncoder.startRecord();
                this.rpcEncoder.writeAcceptedReply(xid, EMPTY_AUTH, 0);
                rmEncoder.endRecord(state);
                this.write(writer.flush());
                break;
            }
            default: {
                if (debug)
                    logger.error(`Unknown procedure: ${proc}`);
            }
        }
    }
    closeWithError(error) {
        if (this.debug)
            this.logger.log(`Closing with error: RpcAcceptStat = ${error}, xid = ${this.lastXid}`);
        const xid = this.lastXid;
        if (xid) {
            const state = this.rmEncoder.startRecord();
            const verify = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
            this.rpcEncoder.writeAcceptedReply(xid, verify, error);
            this.rmEncoder.endRecord(state);
            const bin = this.writer.flush();
            this.duplex.write(bin);
        }
        this.close();
    }
    close() {
        if (this.closed)
            return;
        this.closed = true;
        clearImmediate(this.__uncorkTimer);
        this.__uncorkTimer = null;
        const duplex = this.duplex;
        duplex.removeAllListeners();
        if (!duplex.destroyed)
            duplex.destroy();
    }
    write(buf) {
        if (this.closed)
            return;
        const duplex = this.duplex;
        if (duplex.writableLength > this.maxBackpressure) {
            this.closeWithError(5);
            return;
        }
        const __uncorkTimer = this.__uncorkTimer;
        if (!__uncorkTimer)
            duplex.cork();
        duplex.write(buf);
        if (!__uncorkTimer)
            this.__uncorkTimer = setImmediate(() => {
                this.__uncorkTimer = null;
                duplex.uncork();
            });
    }
    send() { }
}
exports.Nfsv4Connection = Nfsv4Connection;
//# sourceMappingURL=Nfsv4Connection.js.map