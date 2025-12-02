import { KeyCredential, TokenCredential } from "@azure/core-auth";
import { OutputFormat, ProfanityOption, PropertyCollection, PropertyId, SpeechConfig, SpeechSynthesisOutputFormat } from "./Exports.js";
/**
 * Speech translation configuration.
 * @class SpeechTranslationConfig
 */
export declare abstract class SpeechTranslationConfig extends SpeechConfig {
    /**
     * Creates an instance of recognizer config.
     */
    protected constructor();
    /**
     * Static instance of SpeechTranslationConfig returned by passing a subscription key and service region.
     * @member SpeechTranslationConfig.fromSubscription
     * @function
     * @public
     * @param {string} subscriptionKey - The subscription key.
     * @param {string} region - The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {SpeechTranslationConfig} The speech translation config.
     */
    static fromSubscription(subscriptionKey: string, region: string): SpeechTranslationConfig;
    /**
     * Static instance of SpeechTranslationConfig returned by passing authorization token and service region.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by setting the property authorizationToken with a new
     * valid token. Otherwise, all the recognizers created by this SpeechTranslationConfig instance
     * will encounter errors during recognition.
     * As configuration values are copied when creating a new recognizer, the new token value will not apply
     * to recognizers that have already been created.
     * For recognizers that have been created before, you need to set authorization token of the corresponding recognizer
     * to refresh the token. Otherwise, the recognizers will encounter errors during recognition.
     * @member SpeechTranslationConfig.fromAuthorizationToken
     * @function
     * @public
     * @param {string} authorizationToken - The authorization token.
     * @param {string} region - The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {SpeechTranslationConfig} The speech translation config.
     */
    static fromAuthorizationToken(authorizationToken: string, region: string): SpeechTranslationConfig;
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
    static fromHost(hostName: URL, subscriptionKey?: string): SpeechTranslationConfig;
    /**
     * Creates an instance of the speech translation config with specified endpoint and subscription key.
     * This method is intended only for users who use a non-standard service endpoint or paramters.
     * Note: The query properties specified in the endpoint URL are not changed, even if they are
     * set by any other APIs. For example, if language is defined in the uri as query parameter
     * "language=de-DE", and also set by the speechRecognitionLanguage property, the language
     * setting in uri takes precedence, and the effective language is "de-DE".
     * Only the properties that are not specified in the endpoint URL can be set by other APIs.
     * Note: To use authorization token with fromEndpoint, pass an empty string to the subscriptionKey in the
     * fromEndpoint method, and then set authorizationToken="token" on the created SpeechConfig instance to
     * use the authorization token.
     * @member SpeechTranslationConfig.fromEndpoint
     * @function
     * @public
     * @param {URL} endpoint - The service endpoint to connect to.
     * @param {string} subscriptionKey - The subscription key.
     * @returns {SpeechTranslationConfig} A speech translation config instance.
     */
    static fromEndpoint(endpoint: URL, subscriptionKey?: string): SpeechTranslationConfig;
    /**
     * Creates an instance of a speech translation config with a custom endpoint and a credential.
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
     * @returns {SpeechTranslationConfig} A speech factory instance.
     */
    static fromEndpoint(endpoint: URL, credential: KeyCredential | TokenCredential): SpeechTranslationConfig;
    /**
     * Gets/Sets the authorization token.
     * Note: The caller needs to ensure that the authorization token is valid. Before the authorization token
     * expires, the caller needs to refresh it by calling this setter with a new valid token.
     * @member SpeechTranslationConfig.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    abstract set authorizationToken(value: string);
    /**
     * Gets/Sets the speech recognition language.
     * @member SpeechTranslationConfig.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    abstract set speechRecognitionLanguage(value: string);
    /**
     * Add a (text) target language to translate into.
     * @member SpeechTranslationConfig.prototype.addTargetLanguage
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    abstract addTargetLanguage(value: string): void;
    /**
     * Gets the (text) target language to translate into.
     * @member SpeechTranslationConfig.prototype.targetLanguages
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    abstract get targetLanguages(): string[];
    /**
     * Gets the selected voice name.
     * @member SpeechTranslationConfig.prototype.voiceName
     * @function
     * @public
     * @returns {string} The voice name.
     */
    abstract get voiceName(): string;
    /**
     * Gets/Sets voice of the translated language, enable voice synthesis output.
     * @member SpeechTranslationConfig.prototype.voiceName
     * @function
     * @public
     * @param {string} value - The name of the voice.
     */
    abstract set voiceName(value: string);
    /**
     * Sets a named property as value
     * @member SpeechTranslationConfig.prototype.setProperty
     * @function
     * @public
     * @param {string | PropertyId} name - The name of the property to set.
     * @param {string} value - The new value of the property.
     */
    abstract setProperty(name: string | PropertyId, value: string): void;
    /**
     * Dispose of associated resources.
     * @member SpeechTranslationConfig.prototype.close
     * @function
     * @public
     */
    abstract close(): void;
}
/**
 * @private
 * @class SpeechTranslationConfigImpl
 */
export declare class SpeechTranslationConfigImpl extends SpeechTranslationConfig {
    private privSpeechProperties;
    private readonly privTokenCredential?;
    constructor(tokenCredential?: TokenCredential);
    /**
     * Gets/Sets the authorization token.
     * If this is set, subscription key is ignored.
     * User needs to make sure the provided authorization token is valid and not expired.
     * @member SpeechTranslationConfigImpl.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    set authorizationToken(value: string);
    /**
     * Sets the speech recognition language.
     * @member SpeechTranslationConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    set speechRecognitionLanguage(value: string);
    /**
     * Gets the speech recognition language.
     * @member SpeechTranslationConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @return {string} The speechRecognitionLanguage.
     */
    get speechRecognitionLanguage(): string;
    /**
     * @member SpeechTranslationConfigImpl.prototype.subscriptionKey
     * @function
     * @public
     */
    get subscriptionKey(): string;
    /**
     * Gets the output format
     * @member SpeechTranslationConfigImpl.prototype.outputFormat
     * @function
     * @public
     */
    get outputFormat(): OutputFormat;
    /**
     * Gets/Sets the output format
     * @member SpeechTranslationConfigImpl.prototype.outputFormat
     * @function
     * @public
     */
    set outputFormat(value: OutputFormat);
    /**
     * Gets the endpoint id.
     * @member SpeechTranslationConfigImpl.prototype.endpointId
     * @function
     * @public
     */
    get endpointId(): string;
    /**
     * Gets/Sets the endpoint id.
     * @member SpeechTranslationConfigImpl.prototype.endpointId
     * @function
     * @public
     */
    set endpointId(value: string);
    /**
     * Add a (text) target language to translate into.
     * @member SpeechTranslationConfigImpl.prototype.addTargetLanguage
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    addTargetLanguage(value: string): void;
    /**
     * Gets the (text) target language to translate into.
     * @member SpeechTranslationConfigImpl.prototype.targetLanguages
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    get targetLanguages(): string[];
    /**
     * Gets the voice name.
     * @member SpeechTranslationConfigImpl.prototype.voiceName
     * @function
     * @public
     */
    get voiceName(): string;
    /**
     * Gets/Sets the voice of the translated language, enable voice synthesis output.
     * @member SpeechTranslationConfigImpl.prototype.voiceName
     * @function
     * @public
     * @param {string} value - The name of the voice.
     */
    set voiceName(value: string);
    /**
     * Provides the region.
     * @member SpeechTranslationConfigImpl.prototype.region
     * @function
     * @public
     * @returns {string} The region.
     */
    get region(): string;
    get tokenCredential(): TokenCredential | undefined;
    setProxy(proxyHostName: string, proxyPort: number): void;
    setProxy(proxyHostName: string, proxyPort: number, proxyUserName: string, proxyPassword: string): void;
    /**
     * Gets an arbitrary property value.
     * @member SpeechTranslationConfigImpl.prototype.getProperty
     * @function
     * @public
     * @param {string} name - The name of the property.
     * @param {string} def - The default value of the property in case it is not set.
     * @returns {string} The value of the property.
     */
    getProperty(name: string, def?: string): string;
    /**
     * Gets/Sets an arbitrary property value.
     * @member SpeechTranslationConfigImpl.prototype.setProperty
     * @function
     * @public
     * @param {string | PropertyId} name - The name of the property to set.
     * @param {string} value - The value of the property.
     */
    setProperty(name: string | PropertyId, value: string): void;
    /**
     * Provides access to custom properties.
     * @member SpeechTranslationConfigImpl.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The properties.
     */
    get properties(): PropertyCollection;
    /**
     * Dispose of associated resources.
     * @member SpeechTranslationConfigImpl.prototype.close
     * @function
     * @public
     */
    close(): void;
    setServiceProperty(name: string, value: string): void;
    setProfanity(profanity: ProfanityOption): void;
    enableAudioLogging(): void;
    requestWordLevelTimestamps(): void;
    enableDictation(): void;
    get speechSynthesisLanguage(): string;
    set speechSynthesisLanguage(language: string);
    get speechSynthesisVoiceName(): string;
    set speechSynthesisVoiceName(voice: string);
    get speechSynthesisOutputFormat(): SpeechSynthesisOutputFormat;
    set speechSynthesisOutputFormat(format: SpeechSynthesisOutputFormat);
}
