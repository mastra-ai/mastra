"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoiceProfileClient = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const AudioConfig_js_1 = require("./Audio/AudioConfig.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Defines VoiceProfileClient class for Speaker Recognition
 * Handles operations from user for Voice Profile operations (e.g. createProfile, deleteProfile)
 * @class VoiceProfileClient
 */
class VoiceProfileClient extends Exports_js_2.Recognizer {
    /**
     * VoiceProfileClient constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - An set of initial properties for this synthesizer (authentication key, region, &c)
     */
    constructor(speechConfig) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(speechConfig, "speechConfig");
        const speechConfigImpl = speechConfig;
        Contracts_js_1.Contracts.throwIfNull(speechConfigImpl, "speechConfig");
        super(AudioConfig_js_1.AudioConfig.fromStreamInput(Exports_js_2.AudioInputStream.createPushStream()), speechConfigImpl.properties, new Exports_js_1.VoiceProfileConnectionFactory());
        this.privProperties = speechConfigImpl.properties.clone();
        this.privVoiceAdapter = this.privReco;
        this.privDisposedVoiceAdapter = false;
    }
    /**
     * The collection of properties and their values defined for this VoiceProfileClient.
     * @member VoiceProfileClient.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this VoiceProfileClient.
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * Gets the authorization token used to communicate with the service.
     * @member VoiceProfileClient.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken() {
        return this.properties.getProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token);
    }
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member VoiceProfileClient.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(token, "token");
        this.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, token);
    }
    /**
     * Create a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.createProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfileType} profileType Type of Voice Profile to be created
     * @param {string} lang Language string (locale) for Voice Profile
     * @return {Promise<VoiceProfile>} - Promise of a VoiceProfile.
     */
    async createProfileAsync(profileType, lang) {
        const profileIds = await this.privVoiceAdapter.createProfile(profileType, lang);
        return new Exports_js_2.VoiceProfile(profileIds[0], profileType);
    }
    /**
     * Get current information of a voice profile
     * @member VoiceProfileClient.prototype.retrieveEnrollmentResultAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to retrieve info for
     * @return {Promise<VoiceProfileEnrollmentResult>} - Promise of a VoiceProfileEnrollmentResult.
     */
    async retrieveEnrollmentResultAsync(profile) {
        return this.privVoiceAdapter.retrieveEnrollmentResult(profile);
    }
    /**
     * Get all voice profiles on account with given voice profile type
     * @member VoiceProfileClient.prototype.getAllProfilesAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfileType} profileType profile type (identification/verification) for which to list profiles
     * @return {Promise<VoiceProfileEnrollmentResult[]>} - Promise of an array of VoiceProfileEnrollmentResults.
     */
    async getAllProfilesAsync(profileType) {
        return this.privVoiceAdapter.getAllProfiles(profileType);
        /*
        const result: { json: { value: EnrollmentResultJSON[] } } = await this.privAdapter.getProfiles(profileType);
        if (profileType === VoiceProfileType.TextIndependentIdentification) {
            return VoiceProfileEnrollmentResult.FromIdentificationProfileList(result.json);
        }
        return VoiceProfileEnrollmentResult.FromVerificationProfileList(result.json);
        */
    }
    /**
     * Get valid authorization phrases for voice profile enrollment
     * @member VoiceProfileClient.prototype.getActivationPhrasesAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfileType} profileType Profile Type to get activation phrases for
     * @param {string} lang Language string (locale) for Voice Profile
     */
    async getActivationPhrasesAsync(profileType, lang) {
        return this.privVoiceAdapter.getActivationPhrases(profileType, lang);
    }
    /**
     * Create a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.enrollProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to create enrollment for
     * @param {AudioConfig} audioConfig source info from which to create enrollment
     * @return {Promise<VoiceProfileEnrollmentResult>} - Promise of a VoiceProfileEnrollmentResult.
     */
    async enrollProfileAsync(profile, audioConfig) {
        const configImpl = audioConfig;
        Contracts_js_1.Contracts.throwIfNullOrUndefined(configImpl, "audioConfig");
        this.audioConfig = audioConfig;
        this.privVoiceAdapter.SpeakerAudioSource = configImpl;
        return this.privVoiceAdapter.enrollProfile(profile);
    }
    /**
     * Delete a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.deleteProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to be deleted
     * @return {Promise<VoiceProfileResult>} - Promise of a VoiceProfileResult.
     */
    async deleteProfileAsync(profile) {
        return this.privVoiceAdapter.deleteProfile(profile);
    }
    /**
     * Remove all enrollments for a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.resetProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to be reset
     * @return {Promise<VoiceProfileResult>} - Promise of a VoiceProfileResult.
     */
    async resetProfileAsync(profile) {
        return this.privVoiceAdapter.resetProfile(profile);
    }
    /**
     * Clean up object and close underlying connection
     * @member VoiceProfileClient.prototype.close
     * @function
     * @async
     * @public
     */
    async close() {
        await this.dispose(true);
    }
    createServiceRecognizer(authentication, connectionFactory, audioConfig, recognizerConfig) {
        const audioImpl = audioConfig;
        return new Exports_js_1.VoiceServiceRecognizer(authentication, connectionFactory, audioImpl, recognizerConfig, this);
    }
    async dispose(disposing) {
        if (this.privDisposedVoiceAdapter) {
            return;
        }
        this.privDisposedVoiceAdapter = true;
        if (disposing) {
            await super.dispose(disposing);
        }
    }
    createRecognizerConfig(speechConfig) {
        return new Exports_js_1.RecognizerConfig(speechConfig, this.properties);
    }
    getResult(result, successReason) {
        const response = new Exports_js_2.VoiceProfileResult(result.ok ? successReason : Exports_js_2.ResultReason.Canceled, result.statusText);
        return (response);
    }
}
exports.VoiceProfileClient = VoiceProfileClient;

//# sourceMappingURL=VoiceProfileClient.js.map
