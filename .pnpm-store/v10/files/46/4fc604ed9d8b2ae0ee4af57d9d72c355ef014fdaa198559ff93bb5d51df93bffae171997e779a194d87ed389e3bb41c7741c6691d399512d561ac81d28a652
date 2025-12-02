"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisAdapterBase = void 0;
const Exports_js_1 = require("../common/Exports.js");
const Exports_js_2 = require("../sdk/Exports.js");
const Exports_js_3 = require("./Exports.js");
const SpeechConnectionMessage_Internal_js_1 = require("./SpeechConnectionMessage.Internal.js");
class SynthesisAdapterBase {
    constructor(authentication, connectionFactory, synthesizerConfig, audioDestination) {
        this.speakOverride = undefined;
        this.receiveMessageOverride = undefined;
        this.connectImplOverride = undefined;
        this.configConnectionOverride = undefined;
        // A promise for a configured connection.
        // Do not consume directly, call fetchConnection instead.
        this.privConnectionConfigurationPromise = undefined;
        if (!authentication) {
            throw new Exports_js_1.ArgumentNullError("authentication");
        }
        if (!connectionFactory) {
            throw new Exports_js_1.ArgumentNullError("connectionFactory");
        }
        if (!synthesizerConfig) {
            throw new Exports_js_1.ArgumentNullError("synthesizerConfig");
        }
        this.privAuthentication = authentication;
        this.privConnectionFactory = connectionFactory;
        this.privSynthesizerConfig = synthesizerConfig;
        this.privIsDisposed = false;
        this.privSessionAudioDestination = audioDestination;
        this.privSynthesisTurn = new Exports_js_3.SynthesisTurn();
        this.privConnectionEvents = new Exports_js_1.EventSource();
        this.privServiceEvents = new Exports_js_1.EventSource();
        this.privSynthesisContext = new Exports_js_3.SynthesisContext();
        this.privAgentConfig = new Exports_js_3.AgentConfig();
        this.connectionEvents.attach((connectionEvent) => {
            if (connectionEvent.name === "ConnectionClosedEvent") {
                const connectionClosedEvent = connectionEvent;
                if (connectionClosedEvent.statusCode !== 1000) {
                    this.cancelSynthesisLocal(Exports_js_2.CancellationReason.Error, connectionClosedEvent.statusCode === 1007 ? Exports_js_2.CancellationErrorCode.BadRequestParameters : Exports_js_2.CancellationErrorCode.ConnectionFailure, `${connectionClosedEvent.reason} websocket error code: ${connectionClosedEvent.statusCode}`);
                }
            }
        });
    }
    get synthesizerConfig() {
        return this.privSynthesizerConfig;
    }
    get synthesisContext() {
        return this.privSynthesisContext;
    }
    get agentConfig() {
        return this.privAgentConfig;
    }
    get connectionEvents() {
        return this.privConnectionEvents;
    }
    get serviceEvents() {
        return this.privServiceEvents;
    }
    set activityTemplate(messagePayload) {
        this.privActivityTemplate = messagePayload;
    }
    get activityTemplate() {
        return this.privActivityTemplate;
    }
    set audioOutputFormat(format) {
        this.privAudioOutputFormat = format;
        this.privSynthesisTurn.audioOutputFormat = format;
        if (this.privSessionAudioDestination !== undefined) {
            this.privSessionAudioDestination.format = format;
        }
        if (this.synthesisContext !== undefined) {
            this.synthesisContext.audioOutputFormat = format;
        }
    }
    isDisposed() {
        return this.privIsDisposed;
    }
    async dispose(reason) {
        this.privIsDisposed = true;
        if (this.privSessionAudioDestination !== undefined) {
            this.privSessionAudioDestination.close();
        }
        if (this.privConnectionConfigurationPromise !== undefined) {
            const connection = await this.privConnectionConfigurationPromise;
            await connection.dispose(reason);
        }
    }
    async connect() {
        await this.connectImpl();
    }
    async sendNetworkMessage(path, payload) {
        const type = typeof payload === "string" ? Exports_js_1.MessageType.Text : Exports_js_1.MessageType.Binary;
        const contentType = typeof payload === "string" ? "application/json" : "";
        const connection = await this.fetchConnection();
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(type, path, this.privSynthesisTurn.requestId, contentType, payload));
    }
    async Speak(text, isSSML, requestId, successCallback, errorCallBack, audioDestination) {
        let ssml;
        if (isSSML) {
            ssml = text;
        }
        else {
            ssml = this.privSynthesizer.buildSsml(text);
        }
        if (this.speakOverride !== undefined) {
            return this.speakOverride(ssml, requestId, successCallback, errorCallBack);
        }
        this.privSuccessCallback = successCallback;
        this.privErrorCallback = errorCallBack;
        this.privSynthesisTurn.startNewSynthesis(requestId, text, isSSML, audioDestination);
        try {
            await this.connectImpl();
            const connection = await this.fetchConnection();
            await this.sendSynthesisContext(connection);
            await this.sendSsmlMessage(connection, ssml, requestId);
            this.onSynthesisStarted(requestId);
            void this.receiveMessage();
        }
        catch (e) {
            this.cancelSynthesisLocal(Exports_js_2.CancellationReason.Error, Exports_js_2.CancellationErrorCode.ConnectionFailure, e);
            return Promise.reject(e);
        }
    }
    async stopSpeaking() {
        await this.connectImpl();
        const connection = await this.fetchConnection();
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_1.MessageType.Text, "synthesis.control", this.privSynthesisTurn.requestId, "application/json", JSON.stringify({
            action: "stop"
        })));
    }
    // Cancels synthesis.
    cancelSynthesis(requestId, _cancellationReason, errorCode, error) {
        const properties = new Exports_js_2.PropertyCollection();
        properties.setProperty(Exports_js_3.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[errorCode]);
        const result = new Exports_js_2.SpeechSynthesisResult(requestId, Exports_js_2.ResultReason.Canceled, undefined, error, properties);
        this.onSynthesisCancelled(result);
        if (!!this.privSuccessCallback) {
            try {
                this.privSuccessCallback(result);
                /* eslint-disable no-empty */
            }
            catch { }
        }
    }
    // Cancels synthesis.
    cancelSynthesisLocal(cancellationReason, errorCode, error) {
        if (!!this.privSynthesisTurn.isSynthesizing) {
            this.privSynthesisTurn.onStopSynthesizing();
            this.cancelSynthesis(this.privSynthesisTurn.requestId, cancellationReason, errorCode, error);
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    processTypeSpecificMessages(_connectionMessage) {
        return true;
    }
    async receiveMessage() {
        try {
            const connection = await this.fetchConnection();
            const message = await connection.read();
            if (this.receiveMessageOverride !== undefined) {
                return this.receiveMessageOverride();
            }
            if (this.privIsDisposed) {
                // We're done.
                return;
            }
            // indicates we are draining the queue and it came with no message;
            if (!message) {
                if (!this.privSynthesisTurn.isSynthesizing) {
                    return;
                }
                else {
                    return this.receiveMessage();
                }
            }
            const connectionMessage = SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage.fromConnectionMessage(message);
            if (connectionMessage.requestId.toLowerCase() === this.privSynthesisTurn.requestId.toLowerCase()) {
                switch (connectionMessage.path.toLowerCase()) {
                    case "turn.start":
                        this.privSynthesisTurn.onServiceTurnStartResponse(connectionMessage.textBody);
                        break;
                    case "response":
                        this.privSynthesisTurn.onServiceResponseMessage(connectionMessage.textBody);
                        break;
                    case "audio":
                        if (this.privSynthesisTurn.streamId.toLowerCase() === connectionMessage.streamId.toLowerCase()
                            && !!connectionMessage.binaryBody) {
                            this.privSynthesisTurn.onAudioChunkReceived(connectionMessage.binaryBody);
                            this.onSynthesizing(connectionMessage.binaryBody);
                            if (this.privSessionAudioDestination !== undefined) {
                                this.privSessionAudioDestination.write(connectionMessage.binaryBody);
                            }
                        }
                        break;
                    case "audio.metadata":
                        const metadataList = Exports_js_3.SynthesisAudioMetadata.fromJSON(connectionMessage.textBody).Metadata;
                        for (const metadata of metadataList) {
                            switch (metadata.Type) {
                                case Exports_js_3.MetadataType.WordBoundary:
                                case Exports_js_3.MetadataType.SentenceBoundary:
                                    this.privSynthesisTurn.onTextBoundaryEvent(metadata);
                                    const wordBoundaryEventArgs = new Exports_js_2.SpeechSynthesisWordBoundaryEventArgs(metadata.Data.Offset, metadata.Data.Duration, metadata.Data.text.Text, metadata.Data.text.Length, metadata.Type === Exports_js_3.MetadataType.WordBoundary
                                        ? this.privSynthesisTurn.currentTextOffset : this.privSynthesisTurn.currentSentenceOffset, metadata.Data.text.BoundaryType);
                                    this.onWordBoundary(wordBoundaryEventArgs);
                                    break;
                                case Exports_js_3.MetadataType.Bookmark:
                                    const bookmarkEventArgs = new Exports_js_2.SpeechSynthesisBookmarkEventArgs(metadata.Data.Offset, metadata.Data.Bookmark);
                                    this.onBookmarkReached(bookmarkEventArgs);
                                    break;
                                case Exports_js_3.MetadataType.Viseme:
                                    this.privSynthesisTurn.onVisemeMetadataReceived(metadata);
                                    if (metadata.Data.IsLastAnimation) {
                                        const visemeEventArgs = new Exports_js_2.SpeechSynthesisVisemeEventArgs(metadata.Data.Offset, metadata.Data.VisemeId, this.privSynthesisTurn.getAndClearVisemeAnimation());
                                        this.onVisemeReceived(visemeEventArgs);
                                    }
                                    break;
                                case Exports_js_3.MetadataType.AvatarSignal:
                                    this.onAvatarEvent(metadata);
                                    break;
                                case Exports_js_3.MetadataType.SessionEnd:
                                    this.privSynthesisTurn.onSessionEnd(metadata);
                                    break;
                            }
                        }
                        break;
                    case "turn.end":
                        this.privSynthesisTurn.onServiceTurnEndResponse();
                        let result;
                        try {
                            result = await this.privSynthesisTurn.constructSynthesisResult();
                            if (!!this.privSuccessCallback) {
                                this.privSuccessCallback(result);
                            }
                        }
                        catch (error) {
                            if (!!this.privErrorCallback) {
                                this.privErrorCallback(error);
                            }
                        }
                        this.onSynthesisCompleted(result);
                        break;
                    default:
                        if (!this.processTypeSpecificMessages(connectionMessage)) {
                            // here are some messages that the derived class has not processed, dispatch them to connect class
                            if (!!this.privServiceEvents) {
                                this.serviceEvents.onEvent(new Exports_js_1.ServiceEvent(connectionMessage.path.toLowerCase(), connectionMessage.textBody));
                            }
                        }
                }
            }
            return this.receiveMessage();
        }
        catch (e) {
            // TODO: What goes here?
        }
    }
    sendSynthesisContext(connection) {
        this.setSynthesisContextSynthesisSection();
        const synthesisContextJson = this.synthesisContext.toJSON();
        if (synthesisContextJson) {
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_1.MessageType.Text, "synthesis.context", this.privSynthesisTurn.requestId, "application/json", synthesisContextJson));
        }
        return;
    }
    setSpeechConfigSynthesisSection() {
        return;
    }
    connectImpl(isUnAuthorized = false) {
        if (this.privConnectionPromise != null) {
            return this.privConnectionPromise.then((connection) => {
                if (connection.state() === Exports_js_1.ConnectionState.Disconnected) {
                    this.privConnectionId = null;
                    this.privConnectionPromise = null;
                    return this.connectImpl();
                }
                return this.privConnectionPromise;
            }, () => {
                this.privConnectionId = null;
                this.privConnectionPromise = null;
                return this.connectImpl();
            });
        }
        this.privAuthFetchEventId = (0, Exports_js_1.createNoDashGuid)();
        this.privConnectionId = (0, Exports_js_1.createNoDashGuid)();
        this.privSynthesisTurn.onPreConnectionStart(this.privAuthFetchEventId);
        const authPromise = isUnAuthorized ? this.privAuthentication.fetchOnExpiry(this.privAuthFetchEventId) : this.privAuthentication.fetch(this.privAuthFetchEventId);
        this.privConnectionPromise = authPromise.then(async (result) => {
            this.privSynthesisTurn.onAuthCompleted(false);
            const connection = await this.privConnectionFactory.create(this.privSynthesizerConfig, result, this.privConnectionId);
            // Attach to the underlying event. No need to hold onto the detach pointers as in the event the connection goes away,
            // it'll stop sending events.
            connection.events.attach((event) => {
                this.connectionEvents.onEvent(event);
            });
            const response = await connection.open();
            if (response.statusCode === 200) {
                this.privSynthesisTurn.onConnectionEstablishCompleted(response.statusCode);
                return Promise.resolve(connection);
            }
            else if (response.statusCode === 403 && !isUnAuthorized) {
                return this.connectImpl(true);
            }
            else {
                this.privSynthesisTurn.onConnectionEstablishCompleted(response.statusCode);
                return Promise.reject(`Unable to contact server. StatusCode: ${response.statusCode},
                    ${this.privSynthesizerConfig.parameters.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Url)} Reason: ${response.reason}`);
            }
        }, (error) => {
            this.privSynthesisTurn.onAuthCompleted(true);
            throw new Error(error);
        });
        // Attach an empty handler to allow the promise to run in the background while
        // other startup events happen. It'll eventually be awaited on.
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        this.privConnectionPromise.catch(() => { });
        return this.privConnectionPromise;
    }
    sendSpeechServiceConfig(connection, SpeechServiceConfigJson) {
        if (SpeechServiceConfigJson) {
            return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_1.MessageType.Text, "speech.config", this.privSynthesisTurn.requestId, "application/json", SpeechServiceConfigJson));
        }
    }
    sendSsmlMessage(connection, ssml, requestId) {
        return connection.send(new SpeechConnectionMessage_Internal_js_1.SpeechConnectionMessage(Exports_js_1.MessageType.Text, "ssml", requestId, "application/ssml+xml", ssml));
    }
    async fetchConnection() {
        if (this.privConnectionConfigurationPromise !== undefined) {
            return this.privConnectionConfigurationPromise.then((connection) => {
                if (connection.state() === Exports_js_1.ConnectionState.Disconnected) {
                    this.privConnectionId = null;
                    this.privConnectionConfigurationPromise = undefined;
                    return this.fetchConnection();
                }
                return this.privConnectionConfigurationPromise;
            }, () => {
                this.privConnectionId = null;
                this.privConnectionConfigurationPromise = undefined;
                return this.fetchConnection();
            });
        }
        this.privConnectionConfigurationPromise = this.configureConnection();
        return await this.privConnectionConfigurationPromise;
    }
    // Takes an established websocket connection to the endpoint and sends speech configuration information.
    async configureConnection() {
        const connection = await this.connectImpl();
        if (this.configConnectionOverride !== undefined) {
            return this.configConnectionOverride(connection);
        }
        this.setSpeechConfigSynthesisSection();
        await this.sendSpeechServiceConfig(connection, this.privSynthesizerConfig.SpeechServiceConfig.serialize());
        return connection;
    }
    onAvatarEvent(_metadata) {
        return;
    }
    onSynthesisStarted(_requestId) {
        return;
    }
    onSynthesizing(_audio) {
        return;
    }
    onSynthesisCancelled(_result) {
        return;
    }
    onSynthesisCompleted(_result) {
        return;
    }
    onWordBoundary(_wordBoundaryEventArgs) {
        return;
    }
    onVisemeReceived(_visemeEventArgs) {
        return;
    }
    onBookmarkReached(_bookmarkEventArgs) {
        return;
    }
}
exports.SynthesisAdapterBase = SynthesisAdapterBase;
SynthesisAdapterBase.telemetryDataEnabled = true;

//# sourceMappingURL=SynthesisAdapterBase.js.map
