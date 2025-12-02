import { TokenCredential } from "@azure/core-auth";
import { IAuthentication, IConnectionFactory, RecognizerConfig, ServiceRecognizerBase, SpeechServiceConfig } from "../common.speech/Exports.js";
import { RecognitionMode } from "../common.speech/ServiceMessages/PhraseDetection/PhraseDetectionContext.js";
import { AudioConfig, PropertyCollection, RecognitionEventArgs, SessionEventArgs, SpeechRecognitionResult } from "./Exports.js";
/**
 * Defines the base class Recognizer which mainly contains common event handlers.
 * @class Recognizer
 */
export declare abstract class Recognizer {
    private privDisposed;
    protected audioConfig: AudioConfig;
    protected privReco: ServiceRecognizerBase;
    protected privProperties: PropertyCollection;
    protected tokenCredential?: TokenCredential;
    private privConnectionFactory;
    /**
     * Creates and initializes an instance of a Recognizer
     * @constructor
     * @param {AudioConfig} audioInput - An optional audio input stream associated with the recognizer
     * @param {PropertyCollection} properties - A set of properties to set on the recognizer
     * @param {IConnectionFactory} connectionFactory - The factory class used to create a custom IConnection for the recognizer
     */
    protected constructor(audioConfig: AudioConfig, properties: PropertyCollection, connectionFactory: IConnectionFactory, tokenCredential?: TokenCredential);
    /**
     * Defines event handler for session started events.
     * @member Recognizer.prototype.sessionStarted
     * @function
     * @public
     */
    sessionStarted: (sender: Recognizer, event: SessionEventArgs) => void;
    /**
     * Defines event handler for session stopped events.
     * @member Recognizer.prototype.sessionStopped
     * @function
     * @public
     */
    sessionStopped: (sender: Recognizer, event: SessionEventArgs) => void;
    /**
     * Defines event handler for speech started events.
     * @member Recognizer.prototype.speechStartDetected
     * @function
     * @public
     */
    speechStartDetected: (sender: Recognizer, event: RecognitionEventArgs) => void;
    /**
     * Defines event handler for speech stopped events.
     * @member Recognizer.prototype.speechEndDetected
     * @function
     * @public
     */
    speechEndDetected: (sender: Recognizer, event: RecognitionEventArgs) => void;
    /**
     * Dispose of associated resources.
     * @member Recognizer.prototype.close
     * @function
     * @public
     */
    close(cb?: () => void, errorCb?: (error: string) => void): void;
    /**
     * @Internal
     * Internal data member to support fromRecognizer* pattern methods on other classes.
     * Do not use externally, object returned will change without warning or notice.
     */
    get internalData(): object;
    /**
     * This method performs cleanup of resources.
     * The Boolean parameter disposing indicates whether the method is called
     * from Dispose (if disposing is true) or from the finalizer (if disposing is false).
     * Derived classes should override this method to dispose resource if needed.
     * @member Recognizer.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - Flag to request disposal.
     */
    protected dispose(disposing: boolean): Promise<void>;
    /**
     * This method returns the current state of the telemetry setting.
     * @member Recognizer.prototype.telemetryEnabled
     * @function
     * @public
     * @returns true if the telemetry is enabled, false otherwise.
     */
    static get telemetryEnabled(): boolean;
    /**
     * This method globally enables or disables telemetry.
     * @member Recognizer.prototype.enableTelemetry
     * @function
     * @public
     * @param enabled - Global setting for telemetry collection.
     * If set to true, telemetry information like microphone errors,
     * recognition errors are collected and sent to Microsoft.
     * If set to false, no telemetry is sent to Microsoft.
     */
    static enableTelemetry(enabled: boolean): void;
    protected abstract createRecognizerConfig(speechConfig: SpeechServiceConfig): RecognizerConfig;
    protected abstract createServiceRecognizer(authentication: IAuthentication, connectionFactory: IConnectionFactory, audioConfig: AudioConfig, recognizerConfig: RecognizerConfig): ServiceRecognizerBase;
    protected implCommonRecognizerSetup(): void;
    protected recognizeOnceAsyncImpl(recognitionMode: RecognitionMode): Promise<SpeechRecognitionResult>;
    protected startContinuousRecognitionAsyncImpl(recognitionMode: RecognitionMode): Promise<void>;
    protected stopContinuousRecognitionAsyncImpl(): Promise<void>;
    protected implRecognizerStop(): Promise<void>;
    protected static getAuth(properties: PropertyCollection, tokenCredential?: TokenCredential): IAuthentication;
}
