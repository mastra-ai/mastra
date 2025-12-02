"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriberRecognizer = void 0;
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
const Exports_js_1 = require("../../common/Exports.js");
const Contracts_js_1 = require("../../sdk/Contracts.js");
const Exports_js_2 = require("../../sdk/Exports.js");
const Exports_js_3 = require("../Exports.js");
const PhraseDetectionContext_js_1 = require("../ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
class TranscriberRecognizer extends Exports_js_2.Recognizer {
    /**
     * TranscriberRecognizer constructor.
     * @constructor
     * @param {SpeechTranslationConfig} speechTranslationConfig - Non-audio configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An audio configuration associated with the recognizer
     */
    constructor(speechTranslationConfig, audioConfig) {
        const speechTranslationConfigImpl = speechTranslationConfig;
        Contracts_js_1.Contracts.throwIfNull(speechTranslationConfigImpl, "speechTranslationConfig");
        const audioConfigImpl = audioConfig;
        Contracts_js_1.Contracts.throwIfNull(audioConfigImpl, "audioConfigImpl");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(speechTranslationConfigImpl.speechRecognitionLanguage, Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage]);
        super(audioConfig, speechTranslationConfigImpl.properties, new Exports_js_3.TranscriberConnectionFactory());
        this.privDisposedRecognizer = false;
        this.isMeetingRecognizer = false;
    }
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        return this.properties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    get properties() {
        return this.privProperties;
    }
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token);
    }
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    set conversation(c) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(c, "Conversation");
        this.isMeetingRecognizer = false;
        this.privConversation = c;
    }
    getConversationInfo() {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privConversation, "Conversation");
        return this.privConversation.conversationInfo;
    }
    set meeting(m) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(m, "Meeting");
        this.isMeetingRecognizer = true;
        this.privMeeting = m;
    }
    getMeetingInfo() {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(this.privMeeting, "Meeting");
        return this.privMeeting.meetingInfo;
    }
    IsMeetingRecognizer() {
        return this.isMeetingRecognizer;
    }
    startContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_1.marshalPromiseToCallbacks)(this.startContinuousRecognitionAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Conversation), cb, err);
    }
    stopContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_1.marshalPromiseToCallbacks)(this.stopContinuousRecognitionAsyncImpl(), cb, err);
    }
    async close() {
        if (!this.privDisposedRecognizer) {
            await this.dispose(true);
        }
    }
    // Push async join/leave conversation message via serviceRecognizer
    async pushConversationEvent(conversationInfo, command) {
        const reco = (this.privReco);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(reco, "serviceRecognizer");
        await reco.sendSpeechEventAsync(conversationInfo, command);
    }
    // Push async join/leave meeting message via serviceRecognizer
    async pushMeetingEvent(meetingInfo, command) {
        const reco = (this.privReco);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(reco, "serviceRecognizer");
        await reco.sendMeetingSpeechEventAsync(meetingInfo, command);
    }
    async enforceAudioGating() {
        const audioConfigImpl = this.audioConfig;
        const format = await audioConfigImpl.format;
        const channels = format.channels;
        if (channels === 1) {
            if (this.properties.getProperty("f0f5debc-f8c9-4892-ac4b-90a7ab359fd2", "false").toLowerCase() !== "true") {
                throw new Error("Single channel audio configuration for MeetingTranscriber is currently under private preview, please contact diarizationrequest@microsoft.com for more details");
            }
        }
        else if (channels !== 8) {
            throw new Error(`Unsupported audio configuration: Detected ${channels}-channel audio`);
        }
        return;
    }
    connectMeetingCallbacks(transcriber) {
        this.isMeetingRecognizer = true;
        this.canceled = (s, e) => {
            if (!!transcriber.canceled) {
                transcriber.canceled(transcriber, e);
            }
        };
        this.recognizing = (s, e) => {
            if (!!transcriber.transcribing) {
                transcriber.transcribing(transcriber, e);
            }
        };
        this.recognized = (s, e) => {
            if (!!transcriber.transcribed) {
                transcriber.transcribed(transcriber, e);
            }
        };
        this.sessionStarted = (s, e) => {
            if (!!transcriber.sessionStarted) {
                transcriber.sessionStarted(transcriber, e);
            }
        };
        this.sessionStopped = (s, e) => {
            if (!!transcriber.sessionStopped) {
                transcriber.sessionStopped(transcriber, e);
            }
        };
    }
    disconnectCallbacks() {
        this.canceled = undefined;
        this.recognizing = undefined;
        this.recognized = undefined;
        this.sessionStarted = undefined;
        this.sessionStopped = undefined;
    }
    /**
     * Disposes any resources held by the object.
     * @member ConversationTranscriber.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - true if disposing the object.
     */
    async dispose(disposing) {
        if (this.privDisposedRecognizer) {
            return;
        }
        if (disposing) {
            this.privDisposedRecognizer = true;
            await this.implRecognizerStop();
        }
        await super.dispose(disposing);
    }
    createRecognizerConfig(speechConfig) {
        return new Exports_js_3.RecognizerConfig(speechConfig, this.properties);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const configImpl = audioConfig;
        return new Exports_js_3.TranscriptionServiceRecognizer(authentication, connectionFactory, configImpl, recognizerConfig, this);
    }
}
exports.TranscriberRecognizer = TranscriberRecognizer;

//# sourceMappingURL=TranscriberRecognizer.js.map
