import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../../common.speech/Exports.js";
import { AudioConfig, AutoDetectSourceLanguageConfig, ConversationTranscriptionEventArgs, ConversationTranscriptionCanceledEventArgs, OutputFormat, PropertyCollection, Recognizer } from "../Exports.js";
import { SpeechConfig } from "../SpeechConfig.js";
/**
 * Performs speech recognition with speaker separation from microphone, file, or other audio input streams, and gets transcribed text as result.
 * @class ConversationTranscriber
 */
export declare class ConversationTranscriber extends Recognizer {
    private privDisposedRecognizer;
    /**
     * ConversationTranscriber constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    constructor(speechConfig: SpeechConfig, audioConfig?: AudioConfig);
    /**
     * ConversationTranscriber constructor.
     * @constructor
     * @param {SpeechConfig} speechConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechConfig: SpeechConfig, autoDetectSourceLanguageConfig: AutoDetectSourceLanguageConfig, audioConfig?: AudioConfig): ConversationTranscriber;
    /**
     * The event transcribing signals that an intermediate transcription result is received.
     * @member ConversationTranscriber.prototype.transcribing
     * @function
     * @public
     */
    transcribing: (sender: Recognizer, event: ConversationTranscriptionEventArgs) => void;
    /**
     * The event transcriber signals that a final recognition result is received.
     * @member ConversationTranscriber.prototype.transcribed
     * @function
     * @public
     */
    transcribed: (sender: Recognizer, event: ConversationTranscriptionEventArgs) => void;
    /**
     * The event canceled signals that an error occurred during transcription.
     * @member ConversationTranscriber.prototype.canceled
     * @function
     * @public
     */
    canceled: (sender: Recognizer, event: ConversationTranscriptionCanceledEventArgs) => void;
    /**
     * Gets the endpoint id of a customized speech model that is used for transcription.
     * @member ConversationTranscriber.prototype.endpointId
     * @function
     * @public
     * @returns {string} the endpoint id of a customized speech model that is used for speech recognition.
     */
    get endpointId(): string;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member ConversationTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member ConversationTranscriber.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
    /**
     * Gets the spoken language of transcription.
     * @member ConversationTranscriber.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} The spoken language of transcription.
     */
    get speechRecognitionLanguage(): string;
    /**
     * Gets the output format of transcription.
     * @member ConversationTranscriber.prototype.outputFormat
     * @function
     * @public
     * @returns {OutputFormat} The output format of transcription.
     */
    get outputFormat(): OutputFormat;
    /**
     * The collection of properties and their values defined for this conversation transcriber.
     * @member ConversationTranscriber.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechRecognizer.
     */
    get properties(): PropertyCollection;
    /**
     * Starts conversation transcription, until stopTranscribingAsync() is called.
     * User must subscribe to events to receive transcription results.
     * @member ConversationTranscriber.prototype.startTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has started.
     * @param err - Callback invoked in case of an error.
     */
    startTranscribingAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Stops conversation transcription.
     * @member ConversationTranscriber.prototype.stopTranscribingAsync
     * @function
     * @public
     * @param cb - Callback invoked once the transcription has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopTranscribingAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * closes all external resources held by an instance of this class.
     * @member ConversationTranscriber.prototype.close
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
