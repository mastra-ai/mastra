"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechRecognizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const PhraseDetectionContext_js_1 = require("../common.speech/ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const Exports_js_2 = require("../common/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
/**
 * Performs speech recognition from microphone, file, or other audio input streams, and gets transcribed text as result.
 * @class SpeechRecognizer
 */
class SpeechRecognizer extends Exports_js_3.Recognizer {
    /**
     * SpeechRecognizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(speechConfig, audioConfig) {
        const speechConfigImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(speechConfigImpl, "speechConfig");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(speechConfigImpl.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage]);
        super(audioConfig, speechConfigImpl.properties, new Exports_js_1.SpeechConnectionFactory(), speechConfig.tokenCredential);
        this.privDisposedRecognizer = false;
    }
    /**
     * SpeechRecognizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechConfig, autoDetectSourceLanguageConfig, audioConfig) {
        const speechConfigImpl = speechConfig;
        autoDetectSourceLanguageConfig.properties.mergeTo(speechConfigImpl.properties);
        const recognizer = new SpeechRecognizer(speechConfig, audioConfig);
        return recognizer;
    }
    /**
     * Gets the endpoint id of a customized speech model that is used for speech recognition.
     * @member SpeechRecognizer.prototype.endpointId
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
     * @member SpeechRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member SpeechRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * Gets the spoken language of recognition.
     * @member SpeechRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of recognition.
     */
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    /**
     * Gets the output format of recognition.
     * @member SpeechRecognizer.prototype.outputFormat
     * @function
     * @public
     * @returns {OutputFormat} The output format of recognition.
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
     * The collection of properties and their values defined for this SpeechRecognizer.
     * @member SpeechRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechRecognizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Starts speech recognition, and stops after the first utterance is recognized.
     * The task returns the recognition text as result.
     * Note: RecognizeOnceAsync() returns when the first utterance has been recognized,
     * so it is suitable only for single shot recognition
     * like command or query. For long-running recognition, use StartContinuousRecognitionAsync() instead.
     * @member SpeechRecognizer.prototype.recognizeOnceAsync
     * @function
     * @public
     * @param cb - Callback that received the SpeechRecognitionResult.
     * @param err - Callback invoked in case of an error.
     */
    recognizeOnceAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.recognizeOnceAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Interactive), cb, err);
    }
    /**
     * Starts speech recognition, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * @member SpeechRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.startContinuousRecognitionAsyncImpl(this.properties.getProperty(Exports_js_1.ForceDictationPropertyName, undefined) === undefined ? PhraseDetectionContext_js_1.RecognitionMode.Conversation : PhraseDetectionContext_js_1.RecognitionMode.Dictation), cb, err);
    }
    /**
     * Stops continuous speech recognition.
     * @member SpeechRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.stopContinuousRecognitionAsyncImpl(), cb, err);
    }
    /**
     * Starts speech recognition with keyword spotting, until
     * stopKeywordRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * Note: Key word spotting functionality is only available on the
     * Speech Devices SDK. This functionality is currently not included in the SDK itself.
     * @member SpeechRecognizer.prototype.startKeywordRecognitionAsync
     * @function
     * @public
     * @param {KeywordRecognitionModel} model The keyword recognition model that
     * specifies the keyword to be recognized.
     * @param cb - Callback invoked once the recognition has started.
     * @param err - Callback invoked in case of an error.
     */
    startKeywordRecognitionAsync(model, cb, err) {
        Contracts_js_1.Contracts.throwIfNull(model, "model");
        if (!!err) {
            err("Not yet implemented.");
        }
    }
    /**
     * Stops continuous speech recognition.
     * Note: Key word spotting functionality is only available on the
     * Speech Devices SDK. This functionality is currently not included in the SDK itself.
     * @member SpeechRecognizer.prototype.stopKeywordRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopKeywordRecognitionAsync(cb) {
        if (!!cb) {
            cb();
        }
    }
    /**
     * closes all external resources held by an instance of this class.
     * @member SpeechRecognizer.prototype.close
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
        return new Exports_js_1.SpeechServiceRecognizer(authentication, connectionFactory, configImpl, recognizerConfig, this);
    }
}
exports.SpeechRecognizer = SpeechRecognizer;

//# sourceMappingURL=SpeechRecognizer.js.map
