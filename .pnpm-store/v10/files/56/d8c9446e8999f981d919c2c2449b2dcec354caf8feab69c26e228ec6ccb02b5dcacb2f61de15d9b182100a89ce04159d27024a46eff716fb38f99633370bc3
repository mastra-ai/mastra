import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { AudioConfig } from "./Audio/AudioConfig.js";
import { PropertyCollection, Recognizer, VoiceProfile, VoiceProfileEnrollmentResult, VoiceProfilePhraseResult, VoiceProfileResult, VoiceProfileType } from "./Exports.js";
import { SpeechConfig } from "./SpeechConfig.js";
/**
 * Defines VoiceProfileClient class for Speaker Recognition
 * Handles operations from user for Voice Profile operations (e.g. createProfile, deleteProfile)
 * @class VoiceProfileClient
 */
export declare class VoiceProfileClient extends Recognizer {
    protected privProperties: PropertyCollection;
    private privVoiceAdapter;
    private privDisposedVoiceAdapter;
    /**
     * VoiceProfileClient constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - An set of initial properties for this synthesizer (authentication key, region, &c)
     */
    constructor(speechConfig: SpeechConfig);
    /**
     * The collection of properties and their values defined for this VoiceProfileClient.
     * @member VoiceProfileClient.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this VoiceProfileClient.
     */
    get properties(): PropertyCollection;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member VoiceProfileClient.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member VoiceProfileClient.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
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
    createProfileAsync(profileType: VoiceProfileType, lang: string): Promise<VoiceProfile>;
    /**
     * Get current information of a voice profile
     * @member VoiceProfileClient.prototype.retrieveEnrollmentResultAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to retrieve info for
     * @return {Promise<VoiceProfileEnrollmentResult>} - Promise of a VoiceProfileEnrollmentResult.
     */
    retrieveEnrollmentResultAsync(profile: VoiceProfile): Promise<VoiceProfileEnrollmentResult>;
    /**
     * Get all voice profiles on account with given voice profile type
     * @member VoiceProfileClient.prototype.getAllProfilesAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfileType} profileType profile type (identification/verification) for which to list profiles
     * @return {Promise<VoiceProfileEnrollmentResult[]>} - Promise of an array of VoiceProfileEnrollmentResults.
     */
    getAllProfilesAsync(profileType: VoiceProfileType): Promise<VoiceProfileEnrollmentResult[]>;
    /**
     * Get valid authorization phrases for voice profile enrollment
     * @member VoiceProfileClient.prototype.getActivationPhrasesAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfileType} profileType Profile Type to get activation phrases for
     * @param {string} lang Language string (locale) for Voice Profile
     */
    getActivationPhrasesAsync(profileType: VoiceProfileType, lang: string): Promise<VoiceProfilePhraseResult>;
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
    enrollProfileAsync(profile: VoiceProfile, audioConfig: AudioConfig): Promise<VoiceProfileEnrollmentResult>;
    /**
     * Delete a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.deleteProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to be deleted
     * @return {Promise<VoiceProfileResult>} - Promise of a VoiceProfileResult.
     */
    deleteProfileAsync(profile: VoiceProfile): Promise<VoiceProfileResult>;
    /**
     * Remove all enrollments for a speaker recognition voice profile
     * @member VoiceProfileClient.prototype.resetProfileAsync
     * @function
     * @public
     * @async
     * @param {VoiceProfile} profile Voice Profile to be reset
     * @return {Promise<VoiceProfileResult>} - Promise of a VoiceProfileResult.
     */
    resetProfileAsync(profile: VoiceProfile): Promise<VoiceProfileResult>;
    /**
     * Clean up object and close underlying connection
     * @member VoiceProfileClient.prototype.close
     * @function
     * @async
     * @public
     */
    close(): Promise<void>;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    protected dispose(disposing: boolean): Promise<void>;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    private getResult;
}
