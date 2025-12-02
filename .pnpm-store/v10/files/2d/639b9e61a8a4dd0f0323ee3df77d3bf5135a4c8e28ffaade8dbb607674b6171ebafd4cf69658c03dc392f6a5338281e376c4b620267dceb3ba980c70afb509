import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { SpeakerRecognitionModel } from "./SpeakerRecognitionModel.js";
import { AudioConfig } from "./Audio/AudioConfig.js";
import { PropertyCollection, Recognizer, SpeakerIdentificationModel, SpeakerRecognitionResult, SpeakerVerificationModel } from "./Exports.js";
import { SpeechConfig } from "./SpeechConfig.js";
/**
 * Defines SpeakerRecognizer class for Speaker Recognition
 * Handles operations from user for Voice Profile operations (e.g. createProfile, deleteProfile)
 * @class SpeakerRecognizer
 */
export declare class SpeakerRecognizer extends Recognizer {
    protected privProperties: PropertyCollection;
    private privDisposedSpeakerRecognizer;
    private privAudioConfigImpl;
    /**
     * Initializes an instance of the SpeakerRecognizer.
     * @constructor
     * @param {SpeechConfig} speechConfig - The set of configuration properties.
     * @param {AudioConfig} audioConfig - An optional audio input config associated with the recognizer
     */
    constructor(speechConfig: SpeechConfig, audioConfig: AudioConfig);
    /**
     * Gets the authorization token used to communicate with the service.
     * @member SpeakerRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member SpeakerRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
    /**
     * The collection of properties and their values defined for this SpeakerRecognizer.
     * @member SpeakerRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeakerRecognizer.
     */
    get properties(): PropertyCollection;
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
    recognizeOnceAsync(model: SpeakerIdentificationModel | SpeakerVerificationModel): Promise<SpeakerRecognitionResult>;
    /**
     * Included for compatibility
     * @member SpeakerRecognizer.prototype.close
     * @function
     * @public
     * @async
     */
    close(): Promise<void>;
    protected recognizeSpeakerOnceAsyncImpl(model: SpeakerRecognitionModel): Promise<SpeakerRecognitionResult>;
    protected implRecognizerStop(): Promise<void>;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    protected dispose(disposing: boolean): Promise<void>;
}
