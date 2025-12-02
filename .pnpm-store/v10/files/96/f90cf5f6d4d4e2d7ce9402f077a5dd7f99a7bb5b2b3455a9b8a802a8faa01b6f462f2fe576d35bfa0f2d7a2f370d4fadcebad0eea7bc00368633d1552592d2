"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
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
exports.WebsocketMessageAdapter = void 0;
const net = __importStar(require("net"));
const tls = __importStar(require("tls"));
const agent_base_1 = __importDefault(require("agent-base"));
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
const ws_1 = __importDefault(require("ws"));
const HeaderNames_js_1 = require("../common.speech/HeaderNames.js");
const Exports_js_1 = require("../common/Exports.js");
class WebsocketMessageAdapter {
    constructor(uri, connectionId, messageFormatter, proxyInfo, headers, enableCompression) {
        if (!uri) {
            throw new Exports_js_1.ArgumentNullError("uri");
        }
        if (!messageFormatter) {
            throw new Exports_js_1.ArgumentNullError("messageFormatter");
        }
        this.proxyInfo = proxyInfo;
        this.privConnectionEvents = new Exports_js_1.EventSource();
        this.privConnectionId = connectionId;
        this.privMessageFormatter = messageFormatter;
        this.privConnectionState = Exports_js_1.ConnectionState.None;
        this.privUri = uri;
        this.privHeaders = headers;
        this.privEnableCompression = enableCompression;
        // Add the connection ID to the headers
        this.privHeaders[HeaderNames_js_1.HeaderNames.ConnectionId] = this.privConnectionId;
        this.privHeaders.connectionId = this.privConnectionId;
        this.privLastErrorReceived = "";
    }
    get state() {
        return this.privConnectionState;
    }
    open() {
        if (this.privConnectionState === Exports_js_1.ConnectionState.Disconnected) {
            return Promise.reject(`Cannot open a connection that is in ${this.privConnectionState} state`);
        }
        if (this.privConnectionEstablishDeferral) {
            return this.privConnectionEstablishDeferral.promise;
        }
        this.privConnectionEstablishDeferral = new Exports_js_1.Deferred();
        this.privCertificateValidatedDeferral = new Exports_js_1.Deferred();
        this.privConnectionState = Exports_js_1.ConnectionState.Connecting;
        try {
            if (typeof WebSocket !== "undefined" && !WebsocketMessageAdapter.forceNpmWebSocket) {
                // Browser handles cert checks.
                this.privCertificateValidatedDeferral.resolve();
                this.privWebsocketClient = new WebSocket(this.privUri);
            }
            else {
                // Workaround for https://github.com/microsoft/cognitive-services-speech-sdk-js/issues/465
                // Which is root caused by https://github.com/TooTallNate/node-agent-base/issues/61
                const uri = new URL(this.privUri);
                let protocol = uri.protocol;
                if (protocol?.toLocaleLowerCase() === "wss:") {
                    protocol = "https:";
                }
                else if (protocol?.toLocaleLowerCase() === "ws:") {
                    protocol = "http:";
                }
                const options = { headers: this.privHeaders, perMessageDeflate: this.privEnableCompression, followRedirects: protocol.toLocaleLowerCase() === "https:" };
                // The ocsp library will handle validation for us and fail the connection if needed.
                this.privCertificateValidatedDeferral.resolve();
                options.agent = this.getAgent();
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                options.agent.protocol = protocol;
                this.privWebsocketClient = new ws_1.default(this.privUri, options);
                this.privWebsocketClient.on("redirect", (redirectUrl) => {
                    const event = new Exports_js_1.ConnectionRedirectEvent(this.privConnectionId, redirectUrl, this.privUri, `Getting redirect URL from endpoint ${this.privUri} with redirect URL '${redirectUrl}'`);
                    Exports_js_1.Events.instance.onEvent(event);
                });
            }
            this.privWebsocketClient.binaryType = "arraybuffer";
            this.privReceivingMessageQueue = new Exports_js_1.Queue();
            this.privDisconnectDeferral = new Exports_js_1.Deferred();
            this.privSendMessageQueue = new Exports_js_1.Queue();
            this.processSendQueue().catch((reason) => {
                Exports_js_1.Events.instance.onEvent(new Exports_js_1.BackgroundEvent(reason));
            });
        }
        catch (error) {
            this.privConnectionEstablishDeferral.resolve(new Exports_js_1.ConnectionOpenResponse(500, error));
            return this.privConnectionEstablishDeferral.promise;
        }
        this.onEvent(new Exports_js_1.ConnectionStartEvent(this.privConnectionId, this.privUri));
        this.privWebsocketClient.onopen = () => {
            this.privCertificateValidatedDeferral.promise.then(() => {
                this.privConnectionState = Exports_js_1.ConnectionState.Connected;
                this.onEvent(new Exports_js_1.ConnectionEstablishedEvent(this.privConnectionId));
                this.privConnectionEstablishDeferral.resolve(new Exports_js_1.ConnectionOpenResponse(200, ""));
            }, (error) => {
                this.privConnectionEstablishDeferral.reject(error);
            });
        };
        this.privWebsocketClient.onerror = (e) => {
            this.onEvent(new Exports_js_1.ConnectionErrorEvent(this.privConnectionId, e.message, e.type));
            this.privLastErrorReceived = e.message;
        };
        this.privWebsocketClient.onclose = (e) => {
            if (this.privConnectionState === Exports_js_1.ConnectionState.Connecting) {
                this.privConnectionState = Exports_js_1.ConnectionState.Disconnected;
                // this.onEvent(new ConnectionEstablishErrorEvent(this.connectionId, e.code, e.reason));
                this.privConnectionEstablishDeferral.resolve(new Exports_js_1.ConnectionOpenResponse(e.code, e.reason + " " + this.privLastErrorReceived));
            }
            else {
                this.privConnectionState = Exports_js_1.ConnectionState.Disconnected;
                this.privWebsocketClient = null;
                this.onEvent(new Exports_js_1.ConnectionClosedEvent(this.privConnectionId, e.code, e.reason));
            }
            this.onClose(e.code, e.reason).catch((reason) => {
                Exports_js_1.Events.instance.onEvent(new Exports_js_1.BackgroundEvent(reason));
            });
        };
        this.privWebsocketClient.onmessage = (e) => {
            const networkReceivedTime = new Date().toISOString();
            if (this.privConnectionState === Exports_js_1.ConnectionState.Connected) {
                const deferred = new Exports_js_1.Deferred();
                // let id = ++this.idCounter;
                this.privReceivingMessageQueue.enqueueFromPromise(deferred.promise);
                if (e.data instanceof ArrayBuffer) {
                    const rawMessage = new Exports_js_1.RawWebsocketMessage(Exports_js_1.MessageType.Binary, e.data);
                    this.privMessageFormatter
                        .toConnectionMessage(rawMessage)
                        .then((connectionMessage) => {
                        this.onEvent(new Exports_js_1.ConnectionMessageReceivedEvent(this.privConnectionId, networkReceivedTime, connectionMessage));
                        deferred.resolve(connectionMessage);
                    }, (error) => {
                        // TODO: Events for these ?
                        deferred.reject(`Invalid binary message format. Error: ${error}`);
                    });
                }
                else {
                    const rawMessage = new Exports_js_1.RawWebsocketMessage(Exports_js_1.MessageType.Text, e.data);
                    this.privMessageFormatter
                        .toConnectionMessage(rawMessage)
                        .then((connectionMessage) => {
                        this.onEvent(new Exports_js_1.ConnectionMessageReceivedEvent(this.privConnectionId, networkReceivedTime, connectionMessage));
                        deferred.resolve(connectionMessage);
                    }, (error) => {
                        // TODO: Events for these ?
                        deferred.reject(`Invalid text message format. Error: ${error}`);
                    });
                }
            }
        };
        return this.privConnectionEstablishDeferral.promise;
    }
    send(message) {
        if (this.privConnectionState !== Exports_js_1.ConnectionState.Connected) {
            return Promise.reject(`Cannot send on connection that is in ${Exports_js_1.ConnectionState[this.privConnectionState]} state`);
        }
        const messageSendStatusDeferral = new Exports_js_1.Deferred();
        const messageSendDeferral = new Exports_js_1.Deferred();
        this.privSendMessageQueue.enqueueFromPromise(messageSendDeferral.promise);
        this.privMessageFormatter
            .fromConnectionMessage(message)
            .then((rawMessage) => {
            messageSendDeferral.resolve({
                Message: message,
                RawWebsocketMessage: rawMessage,
                sendStatusDeferral: messageSendStatusDeferral,
            });
        }, (error) => {
            messageSendDeferral.reject(`Error formatting the message. ${error}`);
        });
        return messageSendStatusDeferral.promise;
    }
    read() {
        if (this.privConnectionState !== Exports_js_1.ConnectionState.Connected) {
            return Promise.reject(`Cannot read on connection that is in ${this.privConnectionState} state`);
        }
        return this.privReceivingMessageQueue.dequeue();
    }
    close(reason) {
        if (this.privWebsocketClient) {
            if (this.privConnectionState !== Exports_js_1.ConnectionState.Disconnected) {
                this.privWebsocketClient.close(1000, reason ? reason : "Normal closure by client");
            }
        }
        else {
            return Promise.resolve();
        }
        return this.privDisconnectDeferral.promise;
    }
    get events() {
        return this.privConnectionEvents;
    }
    sendRawMessage(sendItem) {
        try {
            // indicates we are draining the queue and it came with no message;
            if (!sendItem) {
                return Promise.resolve();
            }
            this.onEvent(new Exports_js_1.ConnectionMessageSentEvent(this.privConnectionId, new Date().toISOString(), sendItem.Message));
            // add a check for the ws readystate in order to stop the red console error 'WebSocket is already in CLOSING or CLOSED state' appearing
            if (this.isWebsocketOpen) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                this.privWebsocketClient.send(sendItem.RawWebsocketMessage.payload);
            }
            else {
                return Promise.reject("websocket send error: Websocket not ready " + this.privConnectionId + " " + sendItem.Message.id + " " + new Error().stack);
            }
            return Promise.resolve();
        }
        catch (e) {
            return Promise.reject(`websocket send error: ${e}`);
        }
    }
    async onClose(code, reason) {
        const closeReason = `Connection closed. ${code}: ${reason}`;
        this.privConnectionState = Exports_js_1.ConnectionState.Disconnected;
        this.privDisconnectDeferral.resolve();
        await this.privReceivingMessageQueue.drainAndDispose(() => {
            // TODO: Events for these ?
            // Logger.instance.onEvent(new LoggingEvent(LogType.Warning, null, `Failed to process received message. Reason: ${closeReason}, Message: ${JSON.stringify(pendingReceiveItem)}`));
        }, closeReason);
        await this.privSendMessageQueue.drainAndDispose((pendingSendItem) => {
            pendingSendItem.sendStatusDeferral.reject(closeReason);
        }, closeReason);
    }
    async processSendQueue() {
        while (true) {
            const itemToSend = this.privSendMessageQueue.dequeue();
            const sendItem = await itemToSend;
            // indicates we are draining the queue and it came with no message;
            if (!sendItem) {
                return;
            }
            try {
                await this.sendRawMessage(sendItem);
                sendItem.sendStatusDeferral.resolve();
            }
            catch (sendError) {
                sendItem.sendStatusDeferral.reject(sendError);
            }
        }
    }
    onEvent(event) {
        this.privConnectionEvents.onEvent(event);
        Exports_js_1.Events.instance.onEvent(event);
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getAgent() {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        const agent = new agent_base_1.default.Agent(this.createConnection);
        if (this.proxyInfo !== undefined &&
            this.proxyInfo.HostName !== undefined &&
            this.proxyInfo.Port > 0) {
            agent.proxyInfo = this.proxyInfo;
        }
        return agent;
    }
    static GetProxyAgent(proxyInfo) {
        const httpProxyOptions = {
            host: proxyInfo.HostName,
            port: proxyInfo.Port,
        };
        if (!!proxyInfo.UserName) {
            httpProxyOptions.headers = {
                "Proxy-Authentication": "Basic " + Buffer.from(`${proxyInfo.UserName}:${(proxyInfo.Password === undefined) ? "" : proxyInfo.Password}`).toString("base64"),
            };
        }
        else {
            httpProxyOptions.headers = {};
        }
        httpProxyOptions.headers.requestOCSP = "true";
        const httpProxyAgent = new https_proxy_agent_1.default(httpProxyOptions);
        return httpProxyAgent;
    }
    createConnection(request, options) {
        let socketPromise;
        options = {
            ...options,
            ...{
                requestOCSP: true,
                servername: options.host
            }
        };
        if (!!this.proxyInfo) {
            const httpProxyAgent = WebsocketMessageAdapter.GetProxyAgent(this.proxyInfo);
            const baseAgent = httpProxyAgent;
            socketPromise = new Promise((resolve, reject) => {
                baseAgent.callback(request, options, (error, socket) => {
                    if (!!error) {
                        reject(error);
                    }
                    else {
                        resolve(socket);
                    }
                });
            });
        }
        else {
            if (!!options.secureEndpoint) {
                socketPromise = Promise.resolve(tls.connect(options));
            }
            else {
                socketPromise = Promise.resolve(net.connect(options));
            }
        }
        return socketPromise;
    }
    get isWebsocketOpen() {
        return this.privWebsocketClient && this.privWebsocketClient.readyState === this.privWebsocketClient.OPEN;
    }
}
exports.WebsocketMessageAdapter = WebsocketMessageAdapter;
WebsocketMessageAdapter.forceNpmWebSocket = false;

//# sourceMappingURL=WebsocketMessageAdapter.js.map
