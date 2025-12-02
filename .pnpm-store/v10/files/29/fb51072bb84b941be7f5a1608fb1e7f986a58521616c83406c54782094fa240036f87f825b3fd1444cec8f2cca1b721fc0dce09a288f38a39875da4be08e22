"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nfsv4TcpClient = void 0;
const tslib_1 = require("tslib");
const net = tslib_1.__importStar(require("node:net"));
const Nfsv4Decoder_1 = require("../Nfsv4Decoder");
const Nfsv4FullEncoder_1 = require("../Nfsv4FullEncoder");
const rm_1 = require("../../../rm");
const rpc_1 = require("../../../rpc");
const constants_1 = require("../constants");
const messages_1 = require("../messages");
class Nfsv4TcpClient {
    static fromDuplex(duplex, opts = {}) {
        const client = new Nfsv4TcpClient(opts);
        client.setSocket(duplex);
        return client;
    }
    constructor(opts = {}) {
        this.socket = null;
        this.connected = false;
        this.connecting = false;
        this.xid = 0;
        this.seqid = 0;
        this.pendingRequests = new Map();
        this.host = opts.host || '127.0.0.1';
        this.port = opts.port || 2049;
        this.timeout = opts.timeout || 30000;
        this.debug = !!opts.debug;
        this.logger = opts.logger || console;
        this.rmDecoder = new rm_1.RmRecordDecoder();
        this.rpcDecoder = new rpc_1.RpcMessageDecoder();
        this.nfsDecoder = new Nfsv4Decoder_1.Nfsv4Decoder();
        this.nfsEncoder = new Nfsv4FullEncoder_1.Nfsv4FullEncoder();
    }
    nextXid() {
        this.xid = (this.xid + 1) >>> 0;
        if (this.xid === 0)
            this.xid = 1;
        return this.xid;
    }
    async connect() {
        if (this.connected)
            return;
        if (this.connecting)
            throw new Error('Connection already in progress');
        return new Promise((resolve, reject) => {
            this.connecting = true;
            const onError = (err) => {
                this.connecting = false;
                this.connected = false;
                if (this.debug)
                    this.logger.error('Socket error:', err);
                reject(err);
            };
            const socket = net.connect({ host: this.host, port: this.port }, () => {
                if (this.debug)
                    this.logger.log(`Connected to NFSv4 server at ${this.host}:${this.port}`);
                socket.removeListener('error', onError);
                resolve();
                this.setSocket(socket);
            });
            socket.once('error', onError);
        });
    }
    setSocket(socket) {
        socket.on('data', this.onData.bind(this));
        socket.on('close', this.onClose.bind(this));
        socket.on('error', (err) => {
            this.connecting = false;
            this.connected = false;
            if (this.debug)
                this.logger.error('Socket error:', err);
        });
        this.connected = true;
        this.connecting = false;
        this.socket = socket;
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
                else if (this.debug)
                    this.logger.error('Failed to decode RPC message');
            }
            record = rmDecoder.readRecord();
        }
    }
    onRpcMessage(msg) {
        if (msg instanceof rpc_1.RpcAcceptedReplyMessage) {
            const pending = this.pendingRequests.get(msg.xid);
            if (!pending) {
                if (this.debug)
                    this.logger.error(`No pending request for XID ${msg.xid}`);
                return;
            }
            this.pendingRequests.delete(msg.xid);
            if (pending.timeout)
                clearTimeout(pending.timeout);
            if (msg.stat !== 0) {
                pending.reject(new Error(`RPC accepted reply error: stat=${msg.stat}`));
                return;
            }
            if (!msg.results) {
                if (pending.resolve.length === 0) {
                    pending.resolve();
                    return;
                }
                pending.reject(new Error('No results in accepted reply'));
                return;
            }
            const response = this.nfsDecoder.decodeCompoundResponse(msg.results);
            if (!response) {
                pending.reject(new Error('Failed to decode COMPOUND response'));
                return;
            }
            pending.resolve(response);
        }
        else if (msg instanceof rpc_1.RpcRejectedReplyMessage) {
            const pending = this.pendingRequests.get(msg.xid);
            if (!pending) {
                if (this.debug)
                    this.logger.error(`No pending request for XID ${msg.xid}`);
                return;
            }
            this.pendingRequests.delete(msg.xid);
            if (pending.timeout)
                clearTimeout(pending.timeout);
            pending.reject(new Error(`RPC rejected reply: stat=${msg.stat}`));
        }
        else {
            if (this.debug)
                this.logger.error('Unexpected RPC message type:', msg);
        }
    }
    onClose() {
        this.connected = false;
        this.connecting = false;
        if (this.debug)
            this.logger.log('Connection closed');
        const error = new Error('Connection closed');
        this.pendingRequests.forEach((pending, xid) => {
            if (pending.timeout)
                clearTimeout(pending.timeout);
            pending.reject(error);
        });
        this.pendingRequests.clear();
    }
    async compound(requestOrOps, tag = '', minorversion = 0) {
        if (!this.connected)
            throw new Error('Not connected');
        const request = requestOrOps instanceof messages_1.Nfsv4CompoundRequest
            ? requestOrOps
            : new messages_1.Nfsv4CompoundRequest(tag, minorversion, requestOrOps);
        const xid = this.nextXid();
        const cred = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
        const verf = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
        const encoded = this.nfsEncoder.encodeCall(xid, 1, cred, verf, request);
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(xid);
                reject(new Error(`Request timeout (XID ${xid})`));
            }, this.timeout);
            this.pendingRequests.set(xid, { resolve, reject, timeout });
            this.socket.write(encoded);
            if (this.debug) {
                this.logger.log(`Sent COMPOUND request (XID ${xid}): ${request.argarray.length} operations`);
            }
        });
    }
    async null() {
        if (!this.connected)
            throw new Error('Not connected');
        const xid = this.nextXid();
        const cred = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
        const verf = new rpc_1.RpcOpaqueAuth(0, constants_1.EMPTY_READER);
        const writer = this.nfsEncoder.writer;
        const rmEncoder = this.nfsEncoder.rmEncoder;
        const rpcEncoder = this.nfsEncoder.rpcEncoder;
        const state = rmEncoder.startRecord();
        rpcEncoder.writeCall(xid, 100003, 4, 0, cred, verf);
        rmEncoder.endRecord(state);
        const encoded = writer.flush();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.pendingRequests.delete(xid);
                reject(new Error(`NULL request timeout (XID ${xid})`));
            }, this.timeout);
            this.pendingRequests.set(xid, {
                resolve: () => resolve(),
                reject,
                timeout,
            });
            this.socket.write(encoded);
            if (this.debug)
                this.logger.log(`Sent NULL request (XID ${xid})`);
        });
    }
    close() {
        if (this.socket) {
            this.socket.end();
            this.socket = null;
        }
        this.connected = false;
        this.connecting = false;
    }
    isConnected() {
        return this.connected;
    }
}
exports.Nfsv4TcpClient = Nfsv4TcpClient;
//# sourceMappingURL=Nfsv4TcpClient.js.map