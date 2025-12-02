"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestSession = void 0;
const Exports_js_1 = require("../common/Exports.js");
const RecognitionEvents_js_1 = require("./RecognitionEvents.js");
const ServiceTelemetryListener_Internal_js_1 = require("./ServiceTelemetryListener.Internal.js");
class RequestSession {
    constructor(audioSourceId) {
        this.privIsDisposed = false;
        this.privDetachables = new Array();
        this.privIsAudioNodeDetached = false;
        this.privIsRecognizing = false;
        this.privIsSpeechEnded = false;
        this.privTurnStartAudioOffset = 0;
        this.privLastRecoOffset = 0;
        this.privHypothesisReceived = false;
        this.privBytesSent = 0;
        this.privRecognitionBytesSent = 0;
        this.privRecogNumber = 0;
        this.privInTurn = false;
        this.privConnectionAttempts = 0;
        this.privAudioSourceId = audioSourceId;
        this.privRequestId = (0, Exports_js_1.createNoDashGuid)();
        this.privAudioNodeId = (0, Exports_js_1.createNoDashGuid)();
        this.privTurnDeferral = new Exports_js_1.Deferred();
        // We're not in a turn, so resolve.
        this.privTurnDeferral.resolve();
    }
    get sessionId() {
        return this.privSessionId;
    }
    get requestId() {
        return this.privRequestId;
    }
    get audioNodeId() {
        return this.privAudioNodeId;
    }
    get turnCompletionPromise() {
        return this.privTurnDeferral.promise;
    }
    get isSpeechEnded() {
        return this.privIsSpeechEnded;
    }
    get isRecognizing() {
        return this.privIsRecognizing;
    }
    get currentTurnAudioOffset() {
        return this.privTurnStartAudioOffset;
    }
    get recogNumber() {
        return this.privRecogNumber;
    }
    get numConnectionAttempts() {
        return this.privConnectionAttempts;
    }
    // The number of bytes sent for the current connection.
    // Counter is reset to 0 each time a connection is established.
    get bytesSent() {
        return this.privBytesSent;
    }
    // The number of bytes sent for the current recognition.
    // Counter is reset to 0 each time recognition is started.
    get recognitionBytesSent() {
        return this.privRecognitionBytesSent;
    }
    listenForServiceTelemetry(eventSource) {
        if (!!this.privServiceTelemetryListener) {
            this.privDetachables.push(eventSource.attachListener(this.privServiceTelemetryListener));
        }
    }
    startNewRecognition() {
        this.privRecognitionBytesSent = 0;
        this.privIsSpeechEnded = false;
        this.privIsRecognizing = true;
        this.privTurnStartAudioOffset = 0;
        this.privLastRecoOffset = 0;
        this.privRecogNumber++;
        this.privServiceTelemetryListener = new ServiceTelemetryListener_Internal_js_1.ServiceTelemetryListener(this.privRequestId, this.privAudioSourceId, this.privAudioNodeId);
        this.onEvent(new RecognitionEvents_js_1.RecognitionTriggeredEvent(this.requestId, this.privSessionId, this.privAudioSourceId, this.privAudioNodeId));
    }
    async onAudioSourceAttachCompleted(audioNode, isError) {
        this.privAudioNode = audioNode;
        this.privIsAudioNodeDetached = false;
        if (isError) {
            await this.onComplete();
        }
        else {
            this.onEvent(new RecognitionEvents_js_1.ListeningStartedEvent(this.privRequestId, this.privSessionId, this.privAudioSourceId, this.privAudioNodeId));
        }
    }
    onPreConnectionStart(authFetchEventId, connectionId) {
        this.privAuthFetchEventId = authFetchEventId;
        this.privSessionId = connectionId;
        this.onEvent(new RecognitionEvents_js_1.ConnectingToServiceEvent(this.privRequestId, this.privAuthFetchEventId, this.privSessionId));
    }
    async onAuthCompleted(isError) {
        if (isError) {
            await this.onComplete();
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async onConnectionEstablishCompleted(statusCode, reason) {
        if (statusCode === 200) {
            this.onEvent(new RecognitionEvents_js_1.RecognitionStartedEvent(this.requestId, this.privAudioSourceId, this.privAudioNodeId, this.privAuthFetchEventId, this.privSessionId));
            if (!!this.privAudioNode) {
                this.privAudioNode.replay();
            }
            this.privTurnStartAudioOffset = this.privLastRecoOffset;
            this.privBytesSent = 0;
            return;
        }
        else if (statusCode === 403) {
            await this.onComplete();
        }
    }
    async onServiceTurnEndResponse(continuousRecognition) {
        this.privTurnDeferral.resolve();
        if (!continuousRecognition || this.isSpeechEnded) {
            await this.onComplete();
            this.privInTurn = false;
        }
        else {
            // Start a new request set.
            this.privTurnStartAudioOffset = this.privLastRecoOffset;
            this.privAudioNode.replay();
        }
    }
    onSpeechContext() {
        this.privRequestId = (0, Exports_js_1.createNoDashGuid)();
    }
    onServiceTurnStartResponse() {
        if (!!this.privTurnDeferral && !!this.privInTurn) {
            // What? How are we starting a turn with another not done?
            this.privTurnDeferral.reject("Another turn started before current completed.");
            // Avoid UnhandledPromiseRejection if privTurnDeferral is not being awaited
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.privTurnDeferral.promise.then().catch(() => { });
        }
        this.privInTurn = true;
        this.privTurnDeferral = new Exports_js_1.Deferred();
    }
    onHypothesis(offset) {
        if (!this.privHypothesisReceived) {
            this.privHypothesisReceived = true;
            this.privServiceTelemetryListener.hypothesisReceived(this.privAudioNode.findTimeAtOffset(offset));
        }
    }
    onPhraseRecognized(offset) {
        this.privServiceTelemetryListener.phraseReceived(this.privAudioNode.findTimeAtOffset(offset));
        this.onServiceRecognized(offset);
    }
    onServiceRecognized(offset) {
        this.privLastRecoOffset = offset;
        this.privHypothesisReceived = false;
        this.privAudioNode.shrinkBuffers(offset);
        this.privConnectionAttempts = 0;
    }
    onAudioSent(bytesSent) {
        this.privBytesSent += bytesSent;
        this.privRecognitionBytesSent += bytesSent;
    }
    onRetryConnection() {
        this.privConnectionAttempts++;
    }
    async dispose() {
        if (!this.privIsDisposed) {
            // we should have completed by now. If we did not its an unknown error.
            this.privIsDisposed = true;
            for (const detachable of this.privDetachables) {
                await detachable.detach();
            }
            if (!!this.privServiceTelemetryListener) {
                this.privServiceTelemetryListener.dispose();
            }
            this.privIsRecognizing = false;
        }
    }
    getTelemetry() {
        if (this.privServiceTelemetryListener.hasTelemetry) {
            return this.privServiceTelemetryListener.getTelemetry();
        }
        else {
            return null;
        }
    }
    async onStopRecognizing() {
        await this.onComplete();
    }
    // Should be called with the audioNode for this session has indicated that it is out of speech.
    onSpeechEnded() {
        this.privIsSpeechEnded = true;
    }
    onEvent(event) {
        if (!!this.privServiceTelemetryListener) {
            this.privServiceTelemetryListener.onEvent(event);
        }
        Exports_js_1.Events.instance.onEvent(event);
    }
    async onComplete() {
        if (!!this.privIsRecognizing) {
            this.privIsRecognizing = false;
            await this.detachAudioNode();
        }
    }
    async detachAudioNode() {
        if (!this.privIsAudioNodeDetached) {
            this.privIsAudioNodeDetached = true;
            if (this.privAudioNode) {
                await this.privAudioNode.detach();
            }
        }
    }
}
exports.RequestSession = RequestSession;

//# sourceMappingURL=RequestSession.js.map
