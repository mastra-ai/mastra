import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { AudioConfig, AutoDetectSourceLanguageConfig, KeywordRecognitionModel, OutputFormat, PropertyCollection, Recognizer, SpeechRecognitionCanceledEventArgs, SpeechRecognitionEventArgs, SpeechRecognitionResult } from "./Exports.js";
import { SpeechConfig } from "./SpeechConfig.js";
/**
 * Performs speech recognition from microphone, file, or other audio input streams, and gets transcribed text as result.
 * @class SpeechRecognizer
 */
export declare class SpeechRecognizer extends Recognizer {
    private privDisposedRecognizer;
    /**
     * SpeechRecognizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(speechConfig: SpeechConfig, audioConfig?: AudioConfig);
    /**
     * SpeechRecognizer constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechConfig: SpeechConfig, autoDetectSourceLanguageConfig: AutoDetectSourceLanguageConfig, audioConfig?: AudioConfig): SpeechRecognizer;
    /**
     * The event recognizing signals that an intermediate recognition result is received.
     * @member SpeechRecognizer.prototype.recognizing
     * @function
     * @public
     */
    recognizing: (sender: Recognizer, event: SpeechRecognitionEventArgs) => void;
    /**
     * The event recognized signals that a final recognition result is received.
     * @member SpeechRecognizer.prototype.recognized
     * @function
     * @public
     */
    recognized: (sender: Recognizer, event: SpeechRecognitionEventArgs) => void;
    /**
     * The event canceled signals that an error occurred during recognition.
     * @member SpeechRecognizer.prototype.canceled
     * @function
     * @public
     */
    canceled: (sender: Recognizer, event: SpeechRecognitionCanceledEventArgs) => void;
    /**
     * Gets the endpoint id of a customized speech model that is used for speech recognition.
     * @member SpeechRecognizer.prototype.endpointId
     * @function
     * @public
     * @returns {string} the endpoint id of a customized speech model that is used for speech recognition.
     */
    get endpointId(): string;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member SpeechRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member SpeechRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
    /**
     * Gets the spoken language of recognition.
     * @member SpeechRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of recognition.
     */
    get speechRecognitionLanguage(): string;
    /**
     * Gets the output format of recognition.
     * @member SpeechRecognizer.prototype.outputFormat
     * @function
     * @public
     * @returns {OutputFormat} The output format of recognition.
     */
    get outputFormat(): OutputFormat;
    /**
     * The collection of properties and their values defined for this SpeechRecognizer.
     * @member SpeechRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechRecognizer.
     */
    get properties(): PropertyCollection;
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
    recognizeOnceAsync(cb?: (e: SpeechRecognitionResult) => void, err?: (e: string) => void): void;
    /**
     * Starts speech recognition, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * @member SpeechRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Stops continuous speech recognition.
     * @member SpeechRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
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
    startKeywordRecognitionAsync(model: KeywordRecognitionModel, cb?: () => void, err?: (e: string) => void): void;
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
    stopKeywordRecognitionAsync(cb?: () => void): void;
    /**
     * closes all external resources held by an instance of this class.
     * @member SpeechRecognizer.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, errorCb?: (error: string) => void): void;
    /**
     * Disposes any resources held by the object.
     * @member SpeechRecognizer.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - true if disposing the object.
     */
    protected dispose(disposing: boolean): Promise<void>;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
}
