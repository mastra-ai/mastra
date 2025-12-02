import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { AudioConfig, AutoDetectSourceLanguageConfig, PropertyCollection, Recognizer, TranslationRecognitionCanceledEventArgs, TranslationRecognitionEventArgs, TranslationRecognitionResult, TranslationSynthesisEventArgs } from "./Exports.js";
import { SpeechTranslationConfig } from "./SpeechTranslationConfig.js";
/**
 * Translation recognizer
 * @class TranslationRecognizer
 */
export declare class TranslationRecognizer extends Recognizer {
    /**
     * The event recognizing signals that an intermediate recognition result is received.
     * @member TranslationRecognizer.prototype.recognizing
     * @function
     * @public
     */
    recognizing: (sender: TranslationRecognizer, event: TranslationRecognitionEventArgs) => void;
    /**
     * The event recognized signals that a final recognition result is received.
     * @member TranslationRecognizer.prototype.recognized
     * @function
     * @public
     */
    recognized: (sender: TranslationRecognizer, event: TranslationRecognitionEventArgs) => void;
    /**
     * The event canceled signals that an error occurred during recognition.
     * @member TranslationRecognizer.prototype.canceled
     * @function
     * @public
     */
    canceled: (sender: TranslationRecognizer, event: TranslationRecognitionCanceledEventArgs) => void;
    /**
     * The event synthesizing signals that a translation synthesis result is received.
     * @member TranslationRecognizer.prototype.synthesizing
     * @function
     * @public
     */
    synthesizing: (sender: TranslationRecognizer, event: TranslationSynthesisEventArgs) => void;
    private privDisposedTranslationRecognizer;
    /**
     * Initializes an instance of the TranslationRecognizer.
     * @constructor
     * @param {SpeechTranslationConfig} speechConfig - Set of properties to configure this recognizer.
     * @param {AudioConfig} audioConfig - An optional audio config associated with the recognizer
     * @param {IConnectionFactory} connectionFactory - An optional connection factory to use to generate the endpoint URIs, headers to set, etc...
     */
    constructor(speechConfig: SpeechTranslationConfig, audioConfig?: AudioConfig, connectionFactory?: IConnectionFactory);
    /**
     * TranslationRecognizer constructor.
     * @constructor
     * @param {SpeechTranslationConfig} speechTranslationConfig - an set of initial properties for this recognizer
     * @param {AutoDetectSourceLanguageConfig} autoDetectSourceLanguageConfig - An source language detection configuration associated with the recognizer
     * @param {AudioConfig} audioConfig - An optional audio configuration associated with the recognizer
     */
    static FromConfig(speechTranslationConfig: SpeechTranslationConfig, autoDetectSourceLanguageConfig: AutoDetectSourceLanguageConfig, audioConfig?: AudioConfig): TranslationRecognizer;
    /**
     * Gets the language name that was set when the recognizer was created.
     * @member TranslationRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} Gets the language name that was set when the recognizer was created.
     */
    get speechRecognitionLanguage(): string;
    /**
     * Gets target languages for translation that were set when the recognizer was created.
     * The language is specified in BCP-47 format. The translation will provide translated text for each of language.
     * @member TranslationRecognizer.prototype.targetLanguages
     * @function
     * @public
     * @returns {string[]} Gets target languages for translation that were set when the recognizer was created.
     */
    get targetLanguages(): string[];
    /**
     * Gets the name of output voice.
     * @member TranslationRecognizer.prototype.voiceName
     * @function
     * @public
     * @returns {string} the name of output voice.
     */
    get voiceName(): string;
    /**
     * The collection of properties and their values defined for this TranslationRecognizer.
     * @member TranslationRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this TranslationRecognizer.
     */
    get properties(): PropertyCollection;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member TranslationRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member TranslationRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - Authorization token.
     */
    set authorizationToken(value: string);
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
    recognizeOnceAsync(cb?: (e: TranslationRecognitionResult) => void, err?: (e: string) => void): void;
    /**
     * Starts recognition and translation, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive translation results.
     * @member TranslationRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback that received the translation has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Stops continuous recognition and translation.
     * @member TranslationRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback that received the translation has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * dynamically remove a language from list of target language
     * (can be used while recognition is ongoing)
     * @member TranslationRecognizer.prototype.removeTargetLanguage
     * @function
     * @param lang - language to be removed
     * @public
     */
    removeTargetLanguage(lang: string): void;
    /**
     * dynamically add a language to list of target language
     * (can be used while recognition is ongoing)
     * @member TranslationRecognizer.prototype.addTargetLanguage
     * @function
     * @param lang - language to be added
     * @public
     */
    addTargetLanguage(lang: string): void;
    /**
     * closes all external resources held by an instance of this class.
     * @member TranslationRecognizer.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, errorCb?: (error: string) => void): void;
    /**
     * handles ConnectionEstablishedEvent for conversation translation scenarios.
     * @member TranslationRecognizer.prototype.onConnection
     * @function
     * @public
     */
    onConnection(): void;
    protected dispose(disposing: boolean): Promise<void>;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    private updateLanguages;
}
