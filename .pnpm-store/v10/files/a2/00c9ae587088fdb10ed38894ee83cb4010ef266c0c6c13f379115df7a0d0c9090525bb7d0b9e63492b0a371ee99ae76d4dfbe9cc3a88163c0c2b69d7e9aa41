"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerRecognizer = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Defines SpeakerRecognizer class for Speaker Recognition
 * Handles operations from user for Voice Profile operations (e.g. createProfile, deleteProfile)
 * @class SpeakerRecognizer
 */
class SpeakerRecognizer extends Exports_js_2.Recognizer {
    /**
     * Initializes an instance of the SpeakerRecognizer.
     * @constructor
     * @param {SpeechConfig} speechConfig - The set of configuration properties.
     * @param {AudioConfig} audioConfig - An optional audio input config associated with the recognizer
     */
    constructor(speechConfig, audioConfig) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(speechConfig, "speechConfig");
        const configImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNullOrUndefined(configImpl, "speechConfig");
        super(audioConfig, configImpl.properties, new Exports_js_1.SpeakerRecognitionConnectionFactory());
        this.privAudioConfigImpl = audioConfig;
        Contracts_js_1.Contracts.throwIfNull(this.privAudioConfigImpl, "audioConfig");
        this.privDisposedSpeakerRecognizer = false;
        this.privProperties = configImpl.properties;
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member SpeakerRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member SpeakerRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * The collection of properties and their values defined for this SpeakerRecognizer.
     * @member SpeakerRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeakerRecognizer.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Get recognition result for model using given audio
     * @member SpeakerRecognizer.prototype.recognizeOnceAsync
     * @function
     * @public
     * @async
     * @param {SpeakerIdentificationModel | SpeakerVerificationModel} model Model containing Voice Profiles to be identified
     * @param cb - Callback invoked once result is returned.
     * @param err - Callback invoked in case of an error.
     */
    async recognizeOnceAsync(model) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedSpeakerRecognizer);
        return this.recognizeSpeakerOnceAsyncImpl(model);
    }
    /**
     * Included for compatibility
     * @member SpeakerRecognizer.prototype.close
     * @function
     * @public
     * @async
     */
    async close() {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedSpeakerRecognizer);
        await this.dispose(true);
    }
    async recognizeSpeakerOnceAsyncImpl(model) {
        Contracts_js_1.Contracts.throwIfDisposed(this.privDisposedSpeakerRecognizer);
        await this.implRecognizerStop();
        const result = await this.privReco.recognizeSpeaker(model);
        await this.implRecognizerStop();
        return result;
    }
    async implRecognizerStop() {
        if (this.privReco) {
            await this.privReco.stopRecognizing();
        }
        return;
    }
    createRecognizerConfig(speechConfig) {
        return new Exports_js_1.RecognizerConfig(speechConfig, this.privProperties);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const audioImpl = audioConfig;
        return new Exports_js_1.SpeakerServiceRecognizer(authentication, connectionFactory, audioImpl, recognizerConfig, this);
    }
    async dispose(disposing) {
        if (this.privDisposedSpeakerRecognizer) {
            return;
        }
        if (disposing) {
            this.privDisposedSpeakerRecognizer = true;
            await super.dispose(disposing);
        }
    }
}
exports.SpeakerRecognizer = SpeakerRecognizer;

//# sourceMappingURL=SpeakerRecognizer.js.map
