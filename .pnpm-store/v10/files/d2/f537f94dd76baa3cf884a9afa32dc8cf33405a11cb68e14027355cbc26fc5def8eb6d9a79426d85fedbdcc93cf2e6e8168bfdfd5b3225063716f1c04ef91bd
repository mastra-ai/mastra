"use strict";
/*!
 * This source file is part of the Gel open source project.
 *
 * Copyright 2019-present MagicStack Inc. and the Gel authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RawConnection = void 0;
const node_net_1 = __importDefault(require("node:net"));
const tls = __importStar(require("node:tls"));
const baseConn_1 = require("./baseConn");
const utils_1 = require("./utils");
const buffer_1 = require("./primitives/buffer");
const event_1 = __importDefault(require("./primitives/event"));
const chars = __importStar(require("./primitives/chars"));
const scram_1 = require("./scram");
const errors = __importStar(require("./errors"));
const cryptoUtils_1 = __importDefault(require("./cryptoUtils"));
var AuthenticationStatuses;
(function (AuthenticationStatuses) {
    AuthenticationStatuses[AuthenticationStatuses["AUTH_OK"] = 0] = "AUTH_OK";
    AuthenticationStatuses[AuthenticationStatuses["AUTH_SASL"] = 10] = "AUTH_SASL";
    AuthenticationStatuses[AuthenticationStatuses["AUTH_SASL_CONTINUE"] = 11] = "AUTH_SASL_CONTINUE";
    AuthenticationStatuses[AuthenticationStatuses["AUTH_SASL_FINAL"] = 12] = "AUTH_SASL_FINAL";
})(AuthenticationStatuses || (AuthenticationStatuses = {}));
const scram = (0, scram_1.getSCRAM)(cryptoUtils_1.default);
const _tlsOptions = new WeakMap();
function getTlsOptions(config) {
    if (_tlsOptions.has(config)) {
        return _tlsOptions.get(config);
    }
    const tlsSecurity = config.tlsSecurity;
    const tlsOptions = {
        ALPNProtocols: ["edgedb-binary"],
        rejectUnauthorized: tlsSecurity !== "insecure",
    };
    const isIPAddress = node_net_1.default.isIP(config.address[0]) !== 0;
    if (!isIPAddress) {
        tlsOptions.servername = config.tlsServerName || config.address[0];
    }
    _tlsOptions.set(config, tlsOptions);
    if (config._tlsCAData !== null) {
        tlsOptions.ca = config._tlsCAData;
    }
    if (tlsSecurity === "no_host_verification") {
        tlsOptions.checkServerIdentity = (hostname, cert) => {
            const err = tls.checkServerIdentity(hostname, cert);
            if (err === undefined) {
                return undefined;
            }
            if (err.message.startsWith("Hostname/IP does not match certificate")) {
                return undefined;
            }
            return err;
        };
    }
    return tlsOptions;
}
class RawConnection extends baseConn_1.BaseRawConnection {
    config;
    sock;
    paused;
    constructor(sock, config, registry) {
        super(registry);
        this.config = config;
        this.paused = false;
        this.sock = sock;
        this.sock.setNoDelay();
        this.sock.on("error", this._onError.bind(this));
        this.sock.on("data", this._onData.bind(this));
        if (tls.TLSSocket && this.sock instanceof tls.TLSSocket) {
            this.sock.on("secureConnect", this._onConnect.bind(this));
        }
        else {
            this.sock.on("connect", this._onConnect.bind(this));
        }
        this.sock.on("close", this._onClose.bind(this));
    }
    _onConnect() {
        this.connWaiter.set();
    }
    _onClose() {
        if (!this.connected) {
            return;
        }
        const newErr = new errors.ClientConnectionClosedError(`the connection has been aborted`);
        if (!this.connWaiter.done || this.messageWaiter) {
            this._abortWaiters(newErr);
        }
        if (this.buffer.takeMessage() &&
            this.buffer.getMessageType() === chars.$E) {
            Object.defineProperty(newErr, "cause", {
                enumerable: false,
                value: this._parseErrorMessage(),
            });
        }
        this._abortWithError(newErr);
    }
    _onError(err) {
        const newErr = new errors.ClientConnectionClosedError(`network error: ${err}`, { cause: err });
        try {
            this._abortWaiters(newErr);
        }
        finally {
            this._abortWithError(newErr);
        }
    }
    _onData(data) {
        try {
            this.buffer.feed(data);
        }
        catch (e) {
            if (this.messageWaiter) {
                this.messageWaiter.setError(e);
                this.messageWaiter = null;
            }
            this._abortWithError(e);
        }
        if (this.messageWaiter) {
            if (this.buffer.takeMessage()) {
                this.messageWaiter.set();
                this.messageWaiter = null;
            }
        }
    }
    async _waitForMessage() {
        if (this.buffer.takeMessage()) {
            return;
        }
        if (this.paused) {
            this.paused = false;
            this.sock.resume();
        }
        this.sock.ref();
        this.messageWaiter = new event_1.default();
        try {
            await this.messageWaiter.wait();
        }
        finally {
            this.sock.unref();
        }
    }
    _sendData(data) {
        this.sock.write(data);
    }
    static newSock(addr, options) {
        if (typeof addr === "string") {
            return node_net_1.default.createConnection(addr);
        }
        const [host, port] = addr;
        if (options == null) {
            return node_net_1.default.createConnection(port, host);
        }
        const opts = { ...options, host, port };
        return tls.connect(opts);
    }
    _abort() {
        if (this.sock && this.connected) {
            this.sock.destroy();
        }
        super._abort();
    }
    async close() {
        if (this.sock && this.connected) {
            this.sock.write(new buffer_1.WriteMessageBuffer().beginMessage(chars.$X).endMessage().unwrap());
        }
        return await super.close();
    }
    static async connectWithTimeout(config, registry, useTls = true) {
        const sock = this.newSock(config.connectionParams.address, useTls ? getTlsOptions(config.connectionParams) : undefined);
        const conn = new this(sock, config, registry);
        const connPromise = conn.connect();
        let timeoutCb = null;
        let timeoutHappened = false;
        if (config.connectTimeout) {
            timeoutCb = setTimeout(() => {
                if (!conn.connected) {
                    timeoutHappened = true;
                    conn.sock.destroy(new errors.ClientConnectionTimeoutError(`connection timed out (${config.connectTimeout}ms)`));
                }
            }, config.connectTimeout);
        }
        try {
            await connPromise;
        }
        catch (e) {
            conn._abort();
            if (timeoutHappened && e instanceof errors.ClientConnectionClosedError) {
                throw new errors.ClientConnectionTimeoutError(`connection timed out (${config.connectTimeout}ms)`);
            }
            if (e instanceof errors.GelError) {
                throw e;
            }
            else {
                let err;
                switch (e.code) {
                    case "EPROTO":
                        if (useTls === true) {
                            try {
                                return this.connectWithTimeout(config, registry, false);
                            }
                            catch {
                            }
                        }
                        err = new errors.ClientConnectionFailedError(`${e.message}\n` +
                            `Attempted to connect using the following credentials:\n` +
                            `${config.connectionParams.explainConfig()}\n`, { cause: e });
                        break;
                    case "ECONNREFUSED":
                    case "ECONNABORTED":
                    case "ECONNRESET":
                    case "ENOTFOUND":
                    case "ENOENT":
                        err = new errors.ClientConnectionFailedTemporarilyError(`${e.message}\n` +
                            `Attempted to connect using the following credentials:\n` +
                            `${config.connectionParams.explainConfig()}\n`, { cause: e });
                        break;
                    default:
                        err = new errors.ClientConnectionFailedError(`${e.message}\n` +
                            `Attempted to connect using the following credentials:\n` +
                            `${config.connectionParams.explainConfig()}\n`, { cause: e });
                        break;
                }
                throw err;
            }
        }
        finally {
            if (timeoutCb != null) {
                clearTimeout(timeoutCb);
            }
        }
        return conn;
    }
    async connect() {
        await this.connWaiter.wait();
        if (this.sock instanceof tls.TLSSocket) {
            if (this.sock.alpnProtocol !== "edgedb-binary") {
                throw new errors.ClientConnectionFailedError("The server doesn't support the edgedb-binary protocol.");
            }
        }
        const handshake = new buffer_1.WriteMessageBuffer();
        handshake
            .beginMessage(chars.$V)
            .writeInt16(this.protocolVersion[0])
            .writeInt16(this.protocolVersion[1]);
        const clientHandshakeOptions = {
            user: this.config.connectionParams.user,
            database: this.config.connectionParams.database,
        };
        if (this.config.connectionParams.secretKey != null) {
            clientHandshakeOptions.secret_key =
                this.config.connectionParams.secretKey;
        }
        handshake.writeInt16(Object.keys(clientHandshakeOptions).length);
        for (const [key, value] of Object.entries(clientHandshakeOptions)) {
            handshake.writeString(key).writeString(value);
        }
        handshake.writeInt16(0);
        handshake.endMessage();
        this.sock.write(handshake.unwrap());
        while (true) {
            if (!this.buffer.takeMessage()) {
                await this._waitForMessage();
            }
            const mtype = this.buffer.getMessageType();
            switch (mtype) {
                case chars.$v: {
                    const hi = this.buffer.readInt16();
                    const lo = this.buffer.readInt16();
                    this._parseHeaders();
                    this.buffer.finishMessage();
                    const proposed = [hi, lo];
                    if ((0, utils_1.versionGreaterThan)(proposed, baseConn_1.PROTO_VER) ||
                        (0, utils_1.versionGreaterThan)(baseConn_1.PROTO_VER_MIN, proposed)) {
                        throw new errors.UnsupportedProtocolVersionError(`the server requested an unsupported version of ` +
                            `the protocol ${hi}.${lo}`);
                    }
                    this.protocolVersion = [hi, lo];
                    break;
                }
                case chars.$R: {
                    const status = this.buffer.readInt32();
                    if (status === AuthenticationStatuses.AUTH_OK) {
                        this.buffer.finishMessage();
                    }
                    else if (status === AuthenticationStatuses.AUTH_SASL) {
                        await this._authSasl();
                    }
                    else {
                        throw new errors.ProtocolError(`unsupported authentication method requested by the ` +
                            `server: ${status}`);
                    }
                    break;
                }
                case chars.$K: {
                    this.serverSecret = this.buffer.readBuffer(32);
                    this.buffer.finishMessage();
                    break;
                }
                case chars.$E: {
                    throw this._parseErrorMessage();
                }
                case chars.$s: {
                    this._parseDescribeStateMessage();
                    break;
                }
                case chars.$Z: {
                    this._parseSyncMessage();
                    if (!(this.sock instanceof tls.TLSSocket) &&
                        typeof Deno === "undefined") {
                        const [major, minor] = this.protocolVersion;
                        throw new errors.ProtocolError(`the protocol version requires TLS: ${major}.${minor}`);
                    }
                    this.connected = true;
                    return;
                }
                default:
                    this._fallthrough();
            }
        }
    }
    async _authSasl() {
        const numMethods = this.buffer.readInt32();
        if (numMethods <= 0) {
            throw new errors.ProtocolError("the server requested SASL authentication but did not offer any methods");
        }
        const methods = [];
        let foundScram256 = false;
        for (let _ = 0; _ < numMethods; _++) {
            const method = this.buffer.readString();
            if (method === "SCRAM-SHA-256") {
                foundScram256 = true;
            }
            methods.push(method);
        }
        this.buffer.finishMessage();
        if (!foundScram256) {
            throw new errors.ProtocolError(`the server offered the following SASL authentication ` +
                `methods: ${methods.join(", ")}, neither are supported.`);
        }
        const clientNonce = scram.generateNonce();
        const [clientFirst, clientFirstBare] = scram.buildClientFirstMessage(clientNonce, this.config.connectionParams.user);
        const wb = new buffer_1.WriteMessageBuffer();
        wb.beginMessage(chars.$p)
            .writeString("SCRAM-SHA-256")
            .writeString(clientFirst)
            .endMessage();
        this.sock.write(wb.unwrap());
        await this._ensureMessage(chars.$R, "SASLContinue");
        let status = this.buffer.readInt32();
        if (status !== AuthenticationStatuses.AUTH_SASL_CONTINUE) {
            throw new errors.ProtocolError(`expected SASLContinue from the server, received ${status}`);
        }
        const serverFirst = this.buffer.readString();
        this.buffer.finishMessage();
        const [serverNonce, salt, itercount] = scram.parseServerFirstMessage(serverFirst);
        const [clientFinal, expectedServerSig] = await scram.buildClientFinalMessage(this.config.connectionParams.password || "", salt, itercount, clientFirstBare, serverFirst, serverNonce);
        wb.reset().beginMessage(chars.$r).writeString(clientFinal).endMessage();
        this.sock.write(wb.unwrap());
        await this._ensureMessage(chars.$R, "SASLFinal");
        status = this.buffer.readInt32();
        if (status !== AuthenticationStatuses.AUTH_SASL_FINAL) {
            throw new errors.ProtocolError(`expected SASLFinal from the server, received ${status}`);
        }
        const serverFinal = this.buffer.readString();
        this.buffer.finishMessage();
        const serverSig = scram.parseServerFinalMessage(serverFinal);
        if (!scram.bufferEquals(serverSig, expectedServerSig)) {
            throw new errors.ProtocolError("server SCRAM proof does not match");
        }
    }
    async _ensureMessage(expectedMtype, err) {
        if (!this.buffer.takeMessage()) {
            await this._waitForMessage();
        }
        const mtype = this.buffer.getMessageType();
        switch (mtype) {
            case chars.$E: {
                throw this._parseErrorMessage();
            }
            case expectedMtype: {
                return;
            }
            default: {
                throw new errors.UnexpectedMessageError(`expected ${err} from the server, received ${chars.chr(mtype)}`);
            }
        }
    }
}
exports.RawConnection = RawConnection;
