import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { AudioConfig, IntentRecognitionCanceledEventArgs, IntentRecognitionEventArgs, IntentRecognitionResult, KeywordRecognitionModel, LanguageUnderstandingModel, PropertyCollection, Recognizer, SpeechConfig } from "./Exports.js";
/**
 * Intent recognizer.
 * @class
 */
export declare class IntentRecognizer extends Recognizer {
    private privDisposedIntentRecognizer;
    private privAddedIntents;
    private privAddedLmIntents;
    private privUmbrellaIntent;
    /**
     * Initializes an instance of the IntentRecognizer.
     * @constructor
     * @param {SpeechConfig} speechConfig - The set of configuration properties.
     * @param {AudioConfig} audioConfig - An optional audio input config associated with the recognizer
     */
    constructor(speechConfig: SpeechConfig, audioConfig?: AudioConfig);
    /**
     * The event recognizing signals that an intermediate recognition result is received.
     * @member IntentRecognizer.prototype.recognizing
     * @function
     * @public
     */
    recognizing: (sender: IntentRecognizer, event: IntentRecognitionEventArgs) => void;
    /**
     * The event recognized signals that a final recognition result is received.
     * @member IntentRecognizer.prototype.recognized
     * @function
     * @public
     */
    recognized: (sender: IntentRecognizer, event: IntentRecognitionEventArgs) => void;
    /**
     * The event canceled signals that an error occurred during recognition.
     * @member IntentRecognizer.prototype.canceled
     * @function
     * @public
     */
    canceled: (sender: IntentRecognizer, event: IntentRecognitionCanceledEventArgs) => void;
    /**
     * Gets the spoken language of recognition.
     * @member IntentRecognizer.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @returns {string} the spoken language of recognition.
     */
    get speechRecognitionLanguage(): string;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member IntentRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * Note: Please use a token derived from your LanguageUnderstanding subscription key for the Intent recognizer.
     * @member IntentRecognizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - Authorization token.
     */
    set authorizationToken(value: string);
    /**
     * The collection of properties and their values defined for this IntentRecognizer.
     * @member IntentRecognizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their
     * values defined for this IntentRecognizer.
     */
    get properties(): PropertyCollection;
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
    recognizeOnceAsync(cb?: (e: IntentRecognitionResult) => void, err?: (e: string) => void): void;
    /**
     * Starts speech recognition, until stopContinuousRecognitionAsync() is called.
     * User must subscribe to events to receive recognition results.
     * @member IntentRecognizer.prototype.startContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has started.
     * @param err - Callback invoked in case of an error.
     */
    startContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Stops continuous intent recognition.
     * @member IntentRecognizer.prototype.stopContinuousRecognitionAsync
     * @function
     * @public
     * @param cb - Callback invoked once the recognition has stopped.
     * @param err - Callback invoked in case of an error.
     */
    stopContinuousRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
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
    startKeywordRecognitionAsync(model: KeywordRecognitionModel, cb?: () => void, err?: (e: string) => void): void;
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
    stopKeywordRecognitionAsync(cb?: () => void, err?: (e: string) => void): void;
    /**
     * Adds a phrase that should be recognized as intent.
     * @member IntentRecognizer.prototype.addIntent
     * @function
     * @public
     * @param {string} intentId - A String that represents the identifier of the intent to be recognized.
     * @param {string} phrase - A String that specifies the phrase representing the intent.
     */
    addIntent(simplePhrase: string, intentId?: string): void;
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
    addIntentWithLanguageModel(intentId: string, model: LanguageUnderstandingModel, intentName?: string): void;
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
    addAllIntents(model: LanguageUnderstandingModel, intentId?: string): void;
    /**
     * closes all external resources held by an instance of this class.
     * @member IntentRecognizer.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, errorCb?: (error: string) => void): void;
    protected createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    protected dispose(disposing: boolean): Promise<void>;
    private buildSpeechContext;
}
