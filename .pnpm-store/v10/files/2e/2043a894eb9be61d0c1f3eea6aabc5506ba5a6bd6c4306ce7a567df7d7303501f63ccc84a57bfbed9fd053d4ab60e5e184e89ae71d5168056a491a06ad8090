"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationTranscriber = void 0;
const Exports_js_1 = require("../../common.speech/Exports.js");
const PhraseDetectionContext_js_1 = require("../../common.speech/ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const Exports_js_2 = require("../../common/Exports.js");
const Contracts_js_1 = require("../Contracts.js");
const Exports_js_3 = require("../Exports.js");
/**
 * Performs speech recognition with speaker separation from microphone, file, or other audio input streams, and gets transcribed text as result.
 * @class ConversationTranscriber
 */
class ConversationTranscriber extends Exports_js_3.Recognizer {
    /**
     * ConversationTranscriber constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(speechConfig, audioConfig) {
        const speechConfigImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(speechConfigImpl, "speechConfig");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(speechConfigImpl.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage]);
        super(audioConfig, speechConfigImpl.properties, new Exports_js_1.ConversationTranscriberConnectionFactory(), speechConfig.tokenCredential);
        this.privProperties.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, "2");
        this.privDisposedRecognizer = false;
    }
    /**
     * ConversationTranscriber constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig) {
        const speechConfigImpl = speechConfig;
        autoDetectSourceLanguageConfig.properties.mergeTo(speechConfigImpl.properties);
        const recognizer = new ConversationTranscriber(speechConfig, audioConfig);
        return recognizer;
    }
    /**
     * Gets the endpoint id of a customized speech model that is used for transcription.
     * @member ConversationTranscriber.prototype.endpointId
     * @function
     * @public
     * @returns {string} the endpoint id of a customized speech model that is used for speech recognition.
     */
    get endpointId() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_EndpointId, "00000000-0000-0000-0000-000000000000");
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member ConversationTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member ConversationTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * Gets the spoken language of transcription.
     * @member ConversationTranscriber.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of transcription.
     */
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    /**
     * Gets the output format of transcription.
     * @member ConversationTranscriber.prototype.outputFormat
     * @function
     * @public
     * @returns {OutputFormat} The output format of transcription.
     */
    get outputFormat() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        if (this.properties.getProperty(Exports_js_1.OutputFormatPropertyName, Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Simple]) === Exports_js_3.OutputFormat[Exports_js_3.OutputFormat.Simple]) {
            return Exports_js_3.OutputFormat.Simple;
        }
        else {
            return Exports_js_3.OutputFormat.Detailed;
        }
    }
    /**
     * The collection of properties and their values defined for this conversation transcriber.
     * @member ConversationTranscriber.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechRecognizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Starts conversation transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member ConversationTranscriber.prototype.startTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    startTranscribingAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.startContinuousRecognitionAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Conversation), cb, err);
    }
    /**
     * Stops conversation transcription.
     * @member ConversationTranscriber.prototype.stopTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopTranscribingAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.stopContinuousRecognitionAsyncImpl(), cb, err);
    }
    /**
     * closes all external resources held by an instance of this class.
     * @member ConversationTranscriber.prototype.close
     * @function
     * @public
     */
    close(cb, errorCb) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, errorCb);
    }
    /**
     * Disposes any resources held by the object.
     * @member SpeechRecognizer.prototype.dispose
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
        return new Exports_js_1.RecognizerConfig(speechConfig, this.privProperties);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const configImpl = audioConfig;
        recognizerConfig.isSpeakerDiarizationEnabled = true;
        return new Exports_js_1.ConversationTranscriptionServiceRecognizer(authentication, connectionFactory, configImpl, recognizerConfig, this);
    }
}
exports.ConversationTranscriber = ConversationTranscriber;

//# sourceMappingURL=ConversationTranscriber.js.map
