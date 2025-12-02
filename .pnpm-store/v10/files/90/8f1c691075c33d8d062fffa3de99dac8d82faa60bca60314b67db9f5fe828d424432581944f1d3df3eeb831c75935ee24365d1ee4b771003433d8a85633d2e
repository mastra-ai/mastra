"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentRecognizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const PhraseDetectionContext_js_1 = require("../common.speech/ServiceMessages/PhraseDetection/PhraseDetectionContext.js");
const Exports_js_2 = require("../common/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_3 = require("./Exports.js");
/**
 * Intent recognizer.
 * @class
 */
class IntentRecognizer extends Exports_js_3.Recognizer {
    /**
     * Initializes an instance of the IntentRecognizer.
     * @constructor
     * @param {SpeechConfig} speechConfig - The set of configuration properties.
     * @param {AudioConfig} audioConfig - An optional audio input config associated with the recognizer
     */
    constructor(speechConfig, audioConfig) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(speechConfig, "speechConfig");
        const configImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNullOrUndefined(configImpl, "speechConfig");
        super(audioConfig, configImpl.properties, new Exports_js_1.IntentConnectionFactory());
        this.privAddedIntents = [];
        this.privAddedLmIntents = {};
        this.privDisposedIntentRecognizer = false;
        this.privProperties = configImpl.properties;
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage), Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage]);
    }
    /**
     * Gets the spoken language of recognition.
     * @member IntentRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} the spoken language of recognition.
     */
    get speechRecognitionLanguage() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedIntentRecognizer);
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member IntentRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * Note: Please use a token derived from your LanguageUnderstanding subscription key for the Intent recognizer.
     * @member IntentRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - Authorization token.
     */
    set authorizationToken(value) {
        this.properties.setProperty(Exports_js_3.PropertyId.SpeechServiceAuthorization_Token, value);
    }
    /**
     * The collection of properties and their values defined for this IntentRecognizer.
     * @member IntentRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their
     * values defined for this IntentRecognizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Starts intent recognition, and stops after the first utterance is recognized.
     * The task returns the recognition text and intent as result.
     * Note: RecognizeOnceAsync() returns when the first utterance has been recognized,
     * so it is suitable only for single shot recognition like command or query.
     * For long-running recognition, use StartContinuousRecognitionAsync() instead.
     * @member IntentRecognizer.prototype.recognizeOnceAsync
     * @function
     * @public
     * @param cb - Callback that received the recognition has finished with an IntentRecognitionResult.
     * @param err - Callback invoked in case of an error.
     */
    recognizeOnceAsync(cb, err) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedIntentRecognizer);
        if (Object.keys(this.privAddedLmIntents).length !== 0 || undefined !== this.privUmbrellaIntent) {
            const context = this.buildSpeechContext();
            this.privReco.speechContext.getContext().intent = context.Intent;
            this.privReco.dynamicGrammar.addReferenceGrammar(context.ReferenceGrammars);
            const intentReco = this.privReco;
            intentReco.setIntents(this.privAddedLmIntents, this.privUmbrellaIntent);
        }
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.recognizeOnceAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Interactive), cb, err);
    }
    /**
     * Starts speech recognition, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * @member IntentRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb, err) {
        if (Object.keys(this.privAddedLmIntents).length !== 0 || undefined !== this.privUmbrellaIntent) {
            const context = this.buildSpeechContext();
            this.privReco.speechContext.getContext().intent = context.Intent;
            this.privReco.dynamicGrammar.addReferenceGrammar(context.ReferenceGrammars);
            const intentReco = this.privReco;
            intentReco.setIntents(this.privAddedLmIntents, this.privUmbrellaIntent);
        }
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.startContinuousRecognitionAsyncImpl(PhraseDetectionContext_js_1.RecognitionMode.Conversation), cb, err);
    }
    /**
     * Stops continuous intent recognition.
     * @member IntentRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb, err) {
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.stopContinuousRecognitionAsyncImpl(), cb, err);
    }
    /**
     * Starts speech recognition with keyword spotting, until stopKeywordRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * Note: Key word spotting functionality is only available on the Speech Devices SDK.
     * This functionality is currently not included in the SDK itself.
     * @member IntentRecognizer.prototype.startKeywordRecognitionAsync
     * @function
     * @public
     * @param {KeywordRecognitionModel} model - The keyword recognition model that specifies the keyword to be recognized.
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
     * Note: Key word spotting functionality is only available on the Speech Devices SDK.
     * This functionality is currently not included in the SDK itself.
     * @member IntentRecognizer.prototype.stopKeywordRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopKeywordRecognitionAsync(cb, err) {
        if (!!cb) {
            try {
                cb();
            }
            catch (e) {
                if (!!err) {
                    err(e);
                }
            }
        }
    }
    /**
     * Adds a phrase that should be recognized as intent.
     * @member IntentRecognizer.prototype.addIntent
     * @function
     * @public
     * @param {string} intentId - A String that represents the identifier of the intent to be recognized.
     * @param {string} phrase - A String that specifies the phrase representing the intent.
     */
    addIntent(simplePhrase, intentId) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedIntentRecognizer);
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(intentId, "intentId");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(simplePhrase, "simplePhrase");
        this.privAddedIntents.push([intentId, simplePhrase]);
    }
    /**
     * Adds an intent from Language Understanding service for recognition.
     * @member IntentRecognizer.prototype.addIntentWithLanguageModel
     * @function
     * @public
     * @param {string} intentId - A String that represents the identifier of the intent
     * to be recognized. Ignored if intentName is empty.
     * @param {string} model - The intent model from Language Understanding service.
     * @param {string} intentName - The intent name defined in the intent model. If it
     * is empty, all intent names defined in the model will be added.
     */
    addIntentWithLanguageModel(intentId, model, intentName) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedIntentRecognizer);
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(intentId, "intentId");
        Contracts_js_1.Contracts.throwIfNull(model, "model");
        const modelImpl = model;
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(modelImpl.appId, "model.appId");
        this.privAddedLmIntents[intentId] = new Exports_js_1.AddedLmIntent(modelImpl, intentName);
    }
    /**
     * @summary Adds all intents from the specified Language Understanding Model.
     * @member IntentRecognizer.prototype.addAllIntents
     * @function
     * @public
     * @function
     * @public
     * @param {LanguageUnderstandingModel} model - The language understanding model containing the intents.
     * @param {string} intentId - A custom id String to be returned in the IntentRecognitionResult's getIntentId() method.
     */
    addAllIntents(model, intentId) {
        Contracts_js_1.Contracts.throwIfNull(model, "model");
        const modelImpl = model;
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(modelImpl.appId, "model.appId");
        this.privUmbrellaIntent = new Exports_js_1.AddedLmIntent(modelImpl, intentId);
    }
    /**
     * closes all external resources held by an instance of this class.
     * @member IntentRecognizer.prototype.close
     * @function
     * @public
     */
    close(cb, errorCb) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedIntentRecognizer);
        (0, Exports_js_2.marshalPromiseToCallbacks)(this.dispose(true), cb, errorCb);
    }
    createRecognizerConfig(speechConfig) {
        return new Exports_js_1.RecognizerConfig(speechConfig, this.privProperties);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const audioImpl = audioConfig;
        return new Exports_js_1.IntentServiceRecognizer(authentication, connectionFactory, audioImpl, recognizerConfig, this);
    }
    async dispose(disposing) {
        if (this.privDisposedIntentRecognizer) {
            return;
        }
        if (disposing) {
            this.privDisposedIntentRecognizer = true;
            await super.dispose(disposing);
        }
    }
    buildSpeechContext() {
        let appId;
        let region;
        let subscriptionKey;
        const refGrammers = [];
        if (undefined !== this.privUmbrellaIntent) {
            appId = this.privUmbrellaIntent.modelImpl.appId;
            region = this.privUmbrellaIntent.modelImpl.region;
            subscriptionKey = this.privUmbrellaIntent.modelImpl.subscriptionKey;
        }
        // Build the reference grammer array.
        for (const intentId of Object.keys(this.privAddedLmIntents)) {
            const addedLmIntent = this.privAddedLmIntents[intentId];
            // validate all the same model, region, and key...
            if (appId === undefined) {
                appId = addedLmIntent.modelImpl.appId;
            }
            else {
                if (appId !== addedLmIntent.modelImpl.appId) {
                    throw new Error("Intents must all be from the same LUIS model");
                }
            }
            if (region === undefined) {
                region = addedLmIntent.modelImpl.region;
            }
            else {
                if (region !== addedLmIntent.modelImpl.region) {
                    throw new Error("Intents must all be from the same LUIS model in a single region");
                }
            }
            if (subscriptionKey === undefined) {
                subscriptionKey = addedLmIntent.modelImpl.subscriptionKey;
            }
            else {
                if (subscriptionKey !== addedLmIntent.modelImpl.subscriptionKey) {
                    throw new Error("Intents must all use the same subscription key");
                }
            }
            const grammer = "luis/" + appId + "-PRODUCTION#" + intentId;
            refGrammers.push(grammer);
        }
        return {
            Intent: {
                id: appId,
                key: (subscriptionKey === undefined) ? this.privProperties.getProperty(Exports_js_3.PropertyId[Exports_js_3.PropertyId.SpeechServiceConnection_Key]) : subscriptionKey,
                provider: "LUIS",
            },
            ReferenceGrammars: (undefined === this.privUmbrellaIntent) ? refGrammers : ["luis/" + appId + "-PRODUCTION"],
        };
    }
}
exports.IntentRecognizer = IntentRecognizer;

//# sourceMappingURL=IntentRecognizer.js.map
