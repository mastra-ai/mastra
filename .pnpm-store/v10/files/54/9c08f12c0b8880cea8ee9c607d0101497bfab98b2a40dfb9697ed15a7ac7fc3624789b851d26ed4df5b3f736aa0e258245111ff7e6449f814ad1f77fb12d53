"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisTurn = void 0;
const Exports_js_1 = require("../common/Exports.js");
const AudioOutputStream_js_1 = require("../sdk/Audio/AudioOutputStream.js");
const Exports_js_2 = require("../sdk/Exports.js");
const SynthesisAudioMetadata_js_1 = require("./ServiceMessages/SynthesisAudioMetadata.js");
const SynthesisEvents_js_1 = require("./SynthesisEvents.js");
class SynthesisTurn {
    constructor() {
        this.privIsDisposed = false;
        this.privIsSynthesizing = false;
        this.privIsSynthesisEnded = false;
        this.privBytesReceived = 0;
        this.privInTurn = false;
        this.privTextOffset = 0;
        this.privNextSearchTextIndex = 0;
        this.privSentenceOffset = 0;
        this.privNextSearchSentenceIndex = 0;
        this.privRequestId = (0, Exports_js_1.createNoDashGuid)();
        this.privTurnDeferral = new Exports_js_1.Deferred();
        // We're not in a turn, so resolve.
        this.privTurnDeferral.resolve();
    }
    get requestId() {
        return this.privRequestId;
    }
    get streamId() {
        return this.privStreamId;
    }
    set streamId(value) {
        this.privStreamId = value;
    }
    get audioOutputFormat() {
        return this.privAudioOutputFormat;
    }
    set audioOutputFormat(format) {
        this.privAudioOutputFormat = format;
    }
    get turnCompletionPromise() {
        return this.privTurnDeferral.promise;
    }
    get isSynthesisEnded() {
        return this.privIsSynthesisEnded;
    }
    get isSynthesizing() {
        return this.privIsSynthesizing;
    }
    get currentTextOffset() {
        return this.privTextOffset;
    }
    get currentSentenceOffset() {
        return this.privSentenceOffset;
    }
    // The number of bytes received for current turn
    get bytesReceived() {
        return this.privBytesReceived;
    }
    get audioDuration() {
        return this.privAudioDuration;
    }
    get extraProperties() {
        if (!!this.privWebRTCSDP) {
            const properties = new Exports_js_2.PropertyCollection();
            properties.setProperty(Exports_js_2.PropertyId.TalkingAvatarService_WebRTC_SDP, this.privWebRTCSDP);
            return properties;
        }
        return undefined;
    }
    async getAllReceivedAudio() {
        if (!!this.privReceivedAudio) {
            return Promise.resolve(this.privReceivedAudio);
        }
        if (!this.privIsSynthesisEnded) {
            return null;
        }
        await this.readAllAudioFromStream();
        return Promise.resolve(this.privReceivedAudio);
    }
    async getAllReceivedAudioWithHeader() {
        if (!!this.privReceivedAudioWithHeader) {
            return this.privReceivedAudioWithHeader;
        }
        if (!this.privIsSynthesisEnded) {
            return null;
        }
        if (this.audioOutputFormat.hasHeader) {
            const audio = await this.getAllReceivedAudio();
            this.privReceivedAudioWithHeader = this.audioOutputFormat.addHeader(audio);
            return this.privReceivedAudioWithHeader;
        }
        else {
            return this.getAllReceivedAudio();
        }
    }
    startNewSynthesis(requestId, rawText, isSSML, audioDestination) {
        this.privIsSynthesisEnded = false;
        this.privIsSynthesizing = true;
        this.privRequestId = requestId;
        this.privRawText = rawText;
        this.privIsSSML = isSSML;
        this.privAudioOutputStream = new AudioOutputStream_js_1.PullAudioOutputStreamImpl();
        this.privAudioOutputStream.format = this.privAudioOutputFormat;
        this.privReceivedAudio = null;
        this.privReceivedAudioWithHeader = null;
        this.privBytesReceived = 0;
        this.privTextOffset = 0;
        this.privNextSearchTextIndex = 0;
        this.privSentenceOffset = 0;
        this.privNextSearchSentenceIndex = 0;
        this.privPartialVisemeAnimation = "";
        this.privWebRTCSDP = "";
        if (audioDestination !== undefined) {
            this.privTurnAudioDestination = audioDestination;
            this.privTurnAudioDestination.format = this.privAudioOutputFormat;
        }
        this.onEvent(new SynthesisEvents_js_1.SynthesisTriggeredEvent(this.requestId, undefined, audioDestination === undefined ? undefined : audioDestination.id()));
    }
    onPreConnectionStart(authFetchEventId) {
        this.privAuthFetchEventId = authFetchEventId;
        this.onEvent(new SynthesisEvents_js_1.ConnectingToSynthesisServiceEvent(this.privRequestId, this.privAuthFetchEventId));
    }
    onAuthCompleted(isError) {
        if (isError) {
            this.onComplete();
        }
    }
    onConnectionEstablishCompleted(statusCode) {
        if (statusCode === 200) {
            this.onEvent(new SynthesisEvents_js_1.SynthesisStartedEvent(this.requestId, this.privAuthFetchEventId));
            this.privBytesReceived = 0;
            return;
        }
        else if (statusCode === 403) {
            this.onComplete();
        }
    }
    onServiceResponseMessage(responseJson) {
        const response = JSON.parse(responseJson);
        this.streamId = response.audio.streamId;
    }
    onServiceTurnEndResponse() {
        this.privInTurn = false;
        this.privTurnDeferral.resolve();
        this.onComplete();
    }
    onServiceTurnStartResponse(responseJson) {
        if (!!this.privTurnDeferral && !!this.privInTurn) {
            // What? How are we starting a turn with another not done?
            this.privTurnDeferral.reject("Another turn started before current completed.");
            // Avoid UnhandledPromiseRejection if privTurnDeferral is not being awaited
            // eslint-disable-next-line @typescript-eslint/no-empty-function
            this.privTurnDeferral.promise.then().catch(() => { });
        }
        this.privInTurn = true;
        this.privTurnDeferral = new Exports_js_1.Deferred();
        const response = JSON.parse(responseJson);
        if (!!response.webrtc) {
            this.privWebRTCSDP = response.webrtc.connectionString;
        }
    }
    onAudioChunkReceived(data) {
        if (this.isSynthesizing) {
            this.privAudioOutputStream.write(data);
            this.privBytesReceived += data.byteLength;
            if (this.privTurnAudioDestination !== undefined) {
                this.privTurnAudioDestination.write(data);
            }
        }
    }
    onTextBoundaryEvent(metadata) {
        this.updateTextOffset(metadata.Data.text.Text, metadata.Type);
    }
    onVisemeMetadataReceived(metadata) {
        if (metadata.Data.AnimationChunk !== undefined) {
            this.privPartialVisemeAnimation += metadata.Data.AnimationChunk;
        }
    }
    onSessionEnd(metadata) {
        this.privAudioDuration = metadata.Data.Offset;
    }
    async constructSynthesisResult() {
        const audioBuffer = await this.getAllReceivedAudioWithHeader();
        return new Exports_js_2.SpeechSynthesisResult(this.requestId, Exports_js_2.ResultReason.SynthesizingAudioCompleted, audioBuffer, undefined, this.extraProperties, this.audioDuration);
    }
    dispose() {
        if (!this.privIsDisposed) {
            // we should have completed by now. If we did not its an unknown error.
            this.privIsDisposed = true;
        }
    }
    onStopSynthesizing() {
        this.onComplete();
    }
    /**
     * Gets the viseme animation string (merged from animation chunk), and clears the internal
     * partial animation.
     */
    getAndClearVisemeAnimation() {
        const animation = this.privPartialVisemeAnimation;
        this.privPartialVisemeAnimation = "";
        return animation;
    }
    onEvent(event) {
        Exports_js_1.Events.instance.onEvent(event);
    }
    /**
     * Check if the text is an XML(SSML) tag
     * @param text
     * @private
     */
    static isXmlTag(text) {
        return text.length >= 2 && text[0] === "<" && text[text.length - 1] === ">";
    }
    updateTextOffset(text, type) {
        if (type === SynthesisAudioMetadata_js_1.MetadataType.WordBoundary) {
            this.privTextOffset = this.privRawText.indexOf(text, this.privNextSearchTextIndex);
            if (this.privTextOffset >= 0) {
                this.privNextSearchTextIndex = this.privTextOffset + text.length;
                if (this.privIsSSML) {
                    if (this.withinXmlTag(this.privTextOffset) && !SynthesisTurn.isXmlTag(text)) {
                        this.updateTextOffset(text, type);
                    }
                }
            }
        }
        else {
            this.privSentenceOffset = this.privRawText.indexOf(text, this.privNextSearchSentenceIndex);
            if (this.privSentenceOffset >= 0) {
                this.privNextSearchSentenceIndex = this.privSentenceOffset + text.length;
                if (this.privIsSSML) {
                    if (this.withinXmlTag(this.privSentenceOffset) && !SynthesisTurn.isXmlTag(text)) {
                        this.updateTextOffset(text, type);
                    }
                }
            }
        }
    }
    onComplete() {
        if (this.privIsSynthesizing) {
            this.privIsSynthesizing = false;
            this.privIsSynthesisEnded = true;
            this.privAudioOutputStream.close();
            this.privInTurn = false;
            if (this.privTurnAudioDestination !== undefined) {
                this.privTurnAudioDestination.close();
                this.privTurnAudioDestination = undefined;
            }
        }
    }
    async readAllAudioFromStream() {
        if (this.privIsSynthesisEnded) {
            this.privReceivedAudio = new ArrayBuffer(this.bytesReceived);
            try {
                await this.privAudioOutputStream.read(this.privReceivedAudio);
            }
            catch (e) {
                this.privReceivedAudio = new ArrayBuffer(0);
            }
        }
    }
    /**
     * Check if current idx is in XML(SSML) tag
     * @param idx
     * @private
     */
    withinXmlTag(idx) {
        return this.privRawText.indexOf("<", idx + 1) > this.privRawText.indexOf(">", idx + 1);
    }
}
exports.SynthesisTurn = SynthesisTurn;

//# sourceMappingURL=SynthesisTurn.js.map
