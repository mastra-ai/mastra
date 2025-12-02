import { IAuthentication, ISynthesisConnectionFactory, SpeechServiceConfig, SynthesisAdapterBase, SynthesisRestAdapter, SynthesizerConfig } from "../common.speech/Exports.js";
import { IAudioDestination, Queue } from "../common/Exports.js";
import { PropertyCollection, SpeechConfig, SpeechSynthesisResult } from "./Exports.js";
export declare abstract class Synthesizer {
    private tokenCredential?;
    protected privAdapter: SynthesisAdapterBase;
    protected privRestAdapter: SynthesisRestAdapter;
    protected privProperties: PropertyCollection;
    protected privConnectionFactory: ISynthesisConnectionFactory;
    protected privDisposed: boolean;
    protected privSynthesizing: boolean;
    protected synthesisRequestQueue: Queue<SynthesisRequest>;
    /**
     * Gets the authorization token used to communicate with the service.
     * @member Synthesizer.prototype.authorizationToken
     * @function
     * @public
     * @returns {string} Authorization token.
     */
    get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token used to communicate with the service.
     * @member Synthesizer.prototype.authorizationToken
     * @function
     * @public
     * @param {string} token - Authorization token.
     */
    set authorizationToken(token: string);
    /**
     * The collection of properties and their values defined for this Synthesizer.
     * @member Synthesizer.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The collection of properties and their values defined for this SpeechSynthesizer.
     */
    get properties(): PropertyCollection;
    /**
     * Indicates if auto detect source language is enabled
     * @member Synthesizer.prototype.autoDetectSourceLanguage
     * @function
     * @public
     * @returns {boolean} if auto detect source language is enabled
     */
    get autoDetectSourceLanguage(): boolean;
    /**
     * Creates and initializes an instance of a Recognizer
     * @constructor
     * @param {SpeechConfig} speechConfig - The speech config to initialize the synthesizer.
     */
    protected constructor(speechConfig: SpeechConfig);
    buildSsml(text: string): string;
    /**
     * This method performs cleanup of resources.
     * The Boolean parameter disposing indicates whether the method is called
     * from Dispose (if disposing is true) or from the finalizer (if disposing is false).
     * Derived classes should override this method to dispose resource if needed.
     * @member Synthesizer.prototype.dispose
     * @function
     * @public
     * @param {boolean} disposing - Flag to request disposal.
     */
    protected dispose(disposing: boolean): Promise<void>;
    protected adapterSpeak(): Promise<void>;
    protected abstract createSynthesisAdapter(authentication: IAuthentication, connectionFactory: ISynthesisConnectionFactory, synthesizerConfig: SynthesizerConfig): SynthesisAdapterBase;
    protected abstract createRestSynthesisAdapter(authentication: IAuthentication, synthesizerConfig: SynthesizerConfig): SynthesisRestAdapter;
    protected createSynthesizerConfig(speechConfig: SpeechServiceConfig): SynthesizerConfig;
    protected implCommonSynthesizeSetup(): void;
    protected static XMLEncode(text: string): string;
}
export declare class SynthesisRequest {
    requestId: string;
    text: string;
    isSSML: boolean;
    cb: (e: SpeechSynthesisResult) => void;
    err: (e: string) => void;
    dataStream: IAudioDestination;
    constructor(requestId: string, text: string, isSSML: boolean, cb?: (e: SpeechSynthesisResult) => void, err?: (e: string) => void, dataStream?: IAudioDestination);
}
