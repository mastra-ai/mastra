import { KeyCredential, TokenCredential } from "@azure/core-auth";
import { OutputFormat, ProfanityOption, PropertyCollection, PropertyId, ServicePropertyChannel, SpeechSynthesisOutputFormat } from "./Exports.js";
/**
 * Speech configuration.
 * @class SpeechConfig
 */
export declare abstract class SpeechConfig {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    protected constructor();
    /**
     * Gets the TokenCredential instance if configured.
     * Only available if using AAD-based authentication via TokenCredential.
     * @returns {TokenCredential | undefined}
     */
    abstract get tokenCredential(): TokenCredential | undefined;
    /**
     * Static instance of SpeechConfig returned by passing subscriptionKey and service region.
     * Note: Please use your LanguageUnderstanding subscription key in case you want to use the Intent recognizer.
     * @member SpeechConfig.fromSubscription
     * @function
     * @public
     * @param {string} subscriptionKey - The subscription key.
     * @param {string} region - The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {SpeechConfig} The speech factory
     */
    static fromSubscription(subscriptionKey: string, region: string): SpeechConfig;
    /**
     * Creates an instance of the speech config with specified endpoint and subscription key.
     * This method is intended only for users who use a non-standard service endpoint or parameters.
     * Note: Please use your LanguageUnderstanding subscription key in case you want to use the Intent recognizer.
     * Note: The query parameters specified in the endpoint URL are not changed, even if they are set by any other APIs.
     * For example, if language is defined in the uri as query parameter "language=de-DE", and also set by
     * SpeechConfig.speechRecognitionLanguage = "en-US", the language setting in uri takes precedence,
     * and the effective language is "de-DE". Only the parameters that are not specified in the
     * endpoint URL can be set by other APIs.
     * Note: To use authorization token with fromEndpoint, pass an empty string to the subscriptionKey in the
     * fromEndpoint method, and then set authorizationToken="token" on the created SpeechConfig instance to
     * use the authorization token.
     * @member SpeechConfig.fromEndpoint
     * @function
     * @public
     * @param {URL} endpoint - The service endpoint to connect to.
     * @param {string} subscriptionKey - The subscription key. If a subscription key is not specified, an authorization token must be set.
     * @returns {SpeechConfig} A speech factory instance.
     */
    static fromEndpoint(endpoint: URL, subscriptionKey?: string): SpeechConfig;
    /**
     * Creates an instance of SpeechConfig with a custom endpoint and a credential.
     * The query parameters specified in the endpoint URI are not changed, even if they are set by any other API call.
     * For example, if the recognition language is defined in the URI query parameter as "language=de-DE", and the property SpeechRecognitionLanguage is set to "en-US",
     * the language set in the URI takes precedence, and "de-DE" remains the expected language.
     * Since parameters included in the endpoint URI take priority, only parameters that are not specified in the endpoint URI can be set by other APIs.
     * Supported credential types:
     * - KeyCredential: For API key-based authentication.
     * - TokenCredential: For Azure AD-based authentication.
     * Note: To use authorization token with fromEndpoint, pass an empty string to the subscriptionKey in the
     * fromEndpoint method, and then set authorizationToken="token" on the created SpeechConfig instance to use the authorization token.
     * @member SpeechConfig.fromEndpoint
     * @function
     * @public
     * @param {URL} endpoint - The service endpoint to connect to.
     * @param {KeyCredential | TokenCredential} credential - The credential used for authentication.
     * @returns {SpeechConfig} A speech factory instance.
     */
    static fromEndpoint(endpoint: URL, credential: KeyCredential | TokenCredential): SpeechConfig;
    /**
     * Creates an instance of the speech config with specified host and subscription key.
     * This method is intended only for users who use a non-default service host. Standard resource path will be assumed.
     * For services with a non-standard resource path or no path at all, use fromEndpoint instead.
     * Note: Query parameters are not allowed in the host URI and must be set by other APIs.
     * Note: To use an authorization token with fromHost, use fromHost(URL),
     * and then set the AuthorizationToken property on the created SpeechConfig instance.
     * Note: Added in version 1.9.0.
     * @member SpeechConfig.fromHost
     * @function
     * @public
     * @param {URL} host - The service endpoint to connect to. Format is "protocol://host:port" where ":port" is optional.
     * @param {string} subscriptionKey - The subscription key. If a subscription key is not specified, an authorization token must be set.
     * @returns {SpeechConfig} A speech factory instance.
     */
    static fromHost(hostName: URL, subscriptionKey?: string): SpeechConfig;
    /**
     * Creates an instance of the speech factory with specified initial authorization token and region.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by calling this setter with a new valid token.
     * Note: Please use a token derived from your LanguageUnderstanding subscription key in case you want
     * to use the Intent recognizer. As configuration values are copied when creating a new recognizer,
     * the new token value will not apply to recognizers that have already been created. For recognizers
     * that have been created before, you need to set authorization token of the corresponding recognizer
     * to refresh the token. Otherwise, the recognizers will encounter errors during recognition.
     * @member SpeechConfig.fromAuthorizationToken
     * @function
     * @public
     * @param {string} authorizationToken - The initial authorization token.
     * @param {string} region - The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {SpeechConfig} A speech factory instance.
     */
    static fromAuthorizationToken(authorizationToken: string, region: string): SpeechConfig;
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server.
     * @param proxyPort The port number of the proxy server.
     */
    abstract setProxy(proxyHostName: string, proxyPort: number): void;
    /**
     * Sets the proxy configuration.
     * Only relevant in Node.js environments.
     * Added in version 1.4.0.
     * @param proxyHostName The host name of the proxy server, without the protocol scheme (http://)
     * @param proxyPort The port number of the proxy server.
     * @param proxyUserName The username of the proxy server.
     * @param proxyPassword The password of the proxy server.
     */
    abstract setProxy(proxyHostName: string, proxyPort: number, proxyUserName: string, proxyPassword: string): void;
    /**
     * Gets the authorization token.
     * @member SpeechConfig.prototype.authorizationToken
     * @function
     * @public
     */
    abstract get authorizationToken(): string;
    /**
     * Gets/Sets the authorization token.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by calling this setter with a new valid token.
     * @member SpeechConfig.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    abstract set authorizationToken(value: string);
    /**
     * Returns the configured language.
     * @member SpeechConfig.prototype.speechRecognitionLanguage
     * @function
     * @public
     */
    abstract get speechRecognitionLanguage(): string;
    /**
     * Gets/Sets the input language.
     * @member SpeechConfig.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    abstract set speechRecognitionLanguage(value: string);
    /**
     * Sets an arbitrary property.
     * @member SpeechConfig.prototype.setProperty
     * @function
     * @public
     * @param {string | PropertyId} name - The name of the property to set.
     * @param {string} value - The new value of the property.
     */
    abstract setProperty(name: string | PropertyId, value: string): void;
    /**
     * Returns the current value of an arbitrary property.
     * @member SpeechConfig.prototype.getProperty
     * @function
     * @public
     * @param {string} name - The name of the property to query.
     * @param {string} def - The value to return in case the property is not known.
     * @returns {string} The current value, or provided default, of the given property.
     */
    abstract getProperty(name: string, def?: string): string;
    /**
     * Gets speech recognition output format (simple or detailed).
     * Note: This output format is for speech recognition result, use [SpeechConfig.speechSynthesisOutputFormat] to
     * get synthesized audio output format.
     * @member SpeechConfig.prototype.outputFormat
     * @function
     * @public
     * @returns {OutputFormat} Returns the output format.
     */
    abstract get outputFormat(): OutputFormat;
    /**
     * Gets/Sets speech recognition output format (simple or detailed).
     * Note: This output format is for speech recognition result, use [SpeechConfig.speechSynthesisOutputFormat] to
     * set synthesized audio output format.
     * @member SpeechConfig.prototype.outputFormat
     * @function
     * @public
     */
    abstract set outputFormat(format: OutputFormat);
    /**
     * Gets the endpoint ID of a customized speech model that is used for speech recognition.
     * @member SpeechConfig.prototype.endpointId
     * @function
     * @public
     * @return {string} The endpoint ID
     */
    abstract get endpointId(): string;
    /**
     * Gets/Sets the endpoint ID of a customized speech model that is used for speech recognition.
     * @member SpeechConfig.prototype.endpointId
     * @function
     * @public
     * @param {string} value - The endpoint ID
     */
    abstract set endpointId(value: string);
    /**
     * Closes the configuration.
     * @member SpeechConfig.prototype.close
     * @function
     * @public
     */
    close(): void;
    /**
     * @member SpeechConfig.prototype.subscriptionKey
     * @function
     * @public
     * @return {string} The subscription key set on the config.
     */
    abstract get subscriptionKey(): string;
    /**
     * @member SpeechConfig.prototype.region
     * @function
     * @public
     * @return {region} The region set on the config.
     */
    abstract get region(): string;
    /**
     * Sets a property value that will be passed to service using the specified channel.
     * Added in version 1.7.0.
     * @member SpeechConfig.prototype.setServiceProperty
     * @function
     * @public
     * @param {name} The name of the property.
     * @param {value} Value to set.
     * @param {channel} The channel used to pass the specified property to service.
     */
    abstract setServiceProperty(name: string, value: string, channel: ServicePropertyChannel): void;
    /**
     * Sets profanity option.
     * Added in version 1.7.0.
     * @member SpeechConfig.prototype.setProfanity
     * @function
     * @public
     * @param {profanity} Profanity option to set.
     */
    abstract setProfanity(profanity: ProfanityOption): void;
    /**
     * Enable audio logging in service.
     * Audio and content logs are stored either in Microsoft-owned storage, or in your own storage account linked
     * to your Cognitive Services subscription (Bring Your Own Storage (BYOS) enabled Speech resource).
     * The logs will be removed after 30 days.
     * Added in version 1.7.0.
     * @member SpeechConfig.prototype.enableAudioLogging
     * @function
     * @public
     */
    abstract enableAudioLogging(): void;
    /**
     * Includes word-level timestamps.
     * Added in version 1.7.0.
     * @member SpeechConfig.prototype.requestWordLevelTimestamps
     * @function
     * @public
     */
    abstract requestWordLevelTimestamps(): void;
    /**
     * Enable dictation. Only supported in speech continuous recognition.
     * Added in version 1.7.0.
     * @member SpeechConfig.prototype.enableDictation
     * @function
     * @public
     */
    abstract enableDictation(): void;
    /**
     * Gets the language of the speech synthesizer.
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisLanguage
     * @function
     * @public
     * @returns {string} Returns the speech synthesis language.
     */
    abstract get speechSynthesisLanguage(): string;
    /**
     * Sets the language of the speech synthesizer.
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisLanguage
     * @function
     * @public
     */
    abstract set speechSynthesisLanguage(language: string);
    /**
     * Gets the voice of the speech synthesizer.
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisVoiceName
     * @function
     * @public
     * @returns {string} Returns the speech synthesis voice.
     */
    abstract get speechSynthesisVoiceName(): string;
    /**
     * Sets the voice of the speech synthesizer. (see <a href="https://aka.ms/speech/tts-languages">available voices</a>).
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisVoiceName
     * @function
     * @public
     */
    abstract set speechSynthesisVoiceName(voice: string);
    /**
     * Gets the speech synthesis output format.
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisOutputFormat
     * @function
     * @public
     * @returns {SpeechSynthesisOutputFormat} Returns the speech synthesis output format
     */
    abstract get speechSynthesisOutputFormat(): SpeechSynthesisOutputFormat;
    /**
     * Sets the speech synthesis output format (e.g. Riff16Khz16BitMonoPcm).
     * The default format is Audio16Khz64KBitRateMonoMp3 for browser and Riff16Khz16BitMonoPcm for Node.JS.
     * Added in version 1.11.0.
     * @member SpeechConfig.prototype.speechSynthesisOutputFormat
     * @function
     * @public
     */
    abstract set speechSynthesisOutputFormat(format: SpeechSynthesisOutputFormat);
}
/**
 * @public
 * @class SpeechConfigImpl
 */
export declare class SpeechConfigImpl extends SpeechConfig {
    private privProperties;
    private readonly privTokenCredential?;
    constructor(tokenCredential?: TokenCredential);
    get properties(): PropertyCollection;
    get endPoint(): URL;
    get subscriptionKey(): string;
    get region(): string;
    get authorizationToken(): string;
    set authorizationToken(value: string);
    get speechRecognitionLanguage(): string;
    set speechRecognitionLanguage(value: string);
    get autoDetectSourceLanguages(): string;
    set autoDetectSourceLanguages(value: string);
    get outputFormat(): OutputFormat;
    set outputFormat(value: OutputFormat);
    get endpointId(): string;
    set endpointId(value: string);
    get tokenCredential(): TokenCredential | undefined;
    setProperty(name: string | PropertyId, value: string): void;
    getProperty(name: string | PropertyId, def?: string): string;
    setProxy(proxyHostName: string, proxyPort: number): void;
    setProxy(proxyHostName: string, proxyPort: number, proxyUserName: string, proxyPassword: string): void;
    setServiceProperty(name: string, value: string): void;
    setProfanity(profanity: ProfanityOption): void;
    enableAudioLogging(): void;
    requestWordLevelTimestamps(): void;
    enableDictation(): void;
    clone(): SpeechConfigImpl;
    get speechSynthesisLanguage(): string;
    set speechSynthesisLanguage(language: string);
    get speechSynthesisVoiceName(): string;
    set speechSynthesisVoiceName(voice: string);
    get speechSynthesisOutputFormat(): SpeechSynthesisOutputFormat;
    set speechSynthesisOutputFormat(format: SpeechSynthesisOutputFormat);
}
