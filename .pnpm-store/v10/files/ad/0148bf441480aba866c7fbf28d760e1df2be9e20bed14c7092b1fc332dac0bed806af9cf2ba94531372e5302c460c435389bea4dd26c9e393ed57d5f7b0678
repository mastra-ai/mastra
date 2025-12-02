"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranslationRecognizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const PhraseDetectionContext_js_1 = require("../common.speech/ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const Exports_js_2 = require("../common/Exports.js");
const Connection_js_1 = require("./Connection.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
/**
 * Translation recognizer
 * @class TranslationRecognizer
 */
class TranslationRecognizer extends Exports_js_3.Recognizer {
    /**
     * Initializes an instance of the TranslationRecognizer.
     * @constructor
     * @param {SpeechTranslationConfig} speechConfig - Set of properties to configure this recognizer.
     * @param {AudioConfig} audioConfig - An optional audio config associated with the recognizer
     * @param {IConnectionFactory} connectionFactory - An optional connection factory to use to generate the endpoint URIs, headers to set, etc...
     */
    constructor(speechConfig, audioConfig, connectionFactory) {
        const configImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(configImpl, "speechConfig");
        super(audioConfig, configImpl.properties, connectionFactory || new Exports_js_1.TranslationConnectionFactory(), speechConfig.tokenCredential);
        this.privDisposedTranslationRecognizer = false;
        if (this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice, undefined) !== undefined) {
            Contracts_js_1.Contracts.throwIfNullOrWhitespace(this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice]);
        }
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages]);
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage]);
    }
    /**
     * TranslationRecognizer constructor.
     * @constructor
     * @param {SpeechTranslationConfig} speechTranslationConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechTranslationConfig, autoDetectSourceLanguageConfig, audioConfig) {
        const speechTranslationConfigImpl = speechTranslationConfig;
        autoDetectSourceLanguageConfig.properties.mergeTo(speechTranslationConfigImpl.properties);
        if (autoDetectSourceLanguageConfig.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, undefined) === Exports_js_1.AutoDetectSourceLanguagesOpenRangeOptionName) {
            speechTranslationConfigImpl.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage, "en-US");
        }
        return new TranslationRecognizer(speechTranslationConfig, audioConfig);
    }
    /**
     * Gets the language name that was set when the recognizer was created.
     * @member TranslationRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} Gets the language name that was set when the recognizer was created.
     */
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedTranslationRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    /**
     * Gets target languages for translation that were set when the recognizer was created.
     * The language is specified in BCP-47 format. The translation will provide translated text for each of language.
     * @member TranslationRecognizer.prototype.targetLanguages
     * @function
     * @public
     * @returns {string[]} Gets target languages for translation that were set when the recognizer was created.
     */
    get targetLanguages() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedTranslationRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages).split(",");
    }
    /**
     * Gets the name of output voice.
     * @member TranslationRecognizer.prototype.voiceName
     * @function
     * @public
     * @returns {string} the name of output voice.
     */
    get voiceName() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedTranslationRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationVoice, undefined);
    }
    /**
     * The collection of properties and their values defined for this TranslationRecognizer.
     * @member TranslationRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this TranslationRecognizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member TranslationRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member TranslationRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - Authorization token.
     */
    set authorizationToken(value) {
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, value);
    }
    /**
     * Starts recognition and translation, and stops after the first utterance is recognized.
     * The task returns the translation text as result.
     * Note: recognizeOnceAsync returns when the first utterance has been recognized, so it is suitable only
     * for single shot recognition like command or query. For long-running recognition,
     * use startContinuousRecognitionAsync() instead.
     * @member TranslationRecognizer.prototype.recognizeOnceAsync
     * @function
     * @public
     * @param cb - Callback that received the result when the translation has completed.
     * @param err - Callback invoked in case of an error.
     */
    recognizeOnceAsync(cb, err) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedTranslationRecognizer);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.recognizeOnceAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Interactive), cb, err);
    }
    /**
     * Starts recognition and translation, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive translation results.
     * @member TranslationRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback that received the translation has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.startContinuousRecognitionAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Conversation), cb, err);
    }
    /**
     * Stops continuous recognition and translation.
     * @member TranslationRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback that received the translation has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.stopContinuousRecognitionAsyncImpl(), cb, err);
    }
    /**
     * dynamically remove a language from list of target language
     * (can be used while recognition is ongoing)
     * @member TranslationRecognizer.prototype.removeTargetLanguage
     * @function
     * @param lang - language to be removed
     * @public
     */
    removeTargetLanguage(lang) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(lang, "language to be removed");
        if (this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined) !== undefined) {
            const languages = this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages).split(",");
            const index = languages.indexOf(lang);
            if (index > -1) {
                languages.splice(index, 1);
                this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, languages.join(","));
                this.updateLanguages(languages);
            }
        }
    }
    /**
     * dynamically add a language to list of target language
     * (can be used while recognition is ongoing)
     * @member TranslationRecognizer.prototype.addTargetLanguage
     * @function
     * @param lang - language to be added
     * @public
     */
    addTargetLanguage(lang) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(lang, "language to be added");
        let languages = [];
        if (this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined) !== undefined) {
            languages = this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages).split(",");
            if (!languages.includes(lang)) {
                languages.push(lang);
                this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, languages.join(","));
            }
        }
        else {
            this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceConnection_TranslationToLanguages, lang);
            languages = [lang];
        }
        this.updateLanguages(languages);
    }
    /**
     * closes all external resources held by an instance of this class.
     * @member TranslationRecognizer.prototype.close
     * @function
     * @public
     */
    close(cb, errorCb) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedTranslationRecognizer);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, errorCb);
    }
    /**
     * handles ConnectionEstablishedEvent for conversation translation scenarios.
     * @member TranslationRecognizer.prototype.onConnection
     * @function
     * @public
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    onConnection() { }
    async dispose(disposing) {
        if (this.privDisposedTranslationRecognizer) {
            return;
        }
        this.privDisposedTranslationRecognizer = true;
        if (disposing) {
            await this.implRecognizerStop();
            await super.dispose(disposing);
        }
    }
    createRecognizerConfig(speechConfig) {
        return new Exports_js_1.RecognizerConfig(speechConfig, this.privProperties);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const configImpl = audioConfig;
        return new Exports_js_1.TranslationServiceRecognizer(authentication, connectionFactory, configImpl, recognizerConfig, this);
    }
    updateLanguages(languages) {
        const conn = Connection_js_1.Connection.fromRecognizer(this);
        if (!!conn) {
            conn.setMessageProperty("speech.context", "translationcontext", { to: languages });
            conn.sendMessageAsync("event", JSON.stringify({
                id: "translation",
                name: "updateLanguage",
                to: languages
            }));
        }
    }
}
exports.TranslationRecognizer = TranslationRecognizer;

//# sourceMappingURL=TranslationRecognizer.js.map
