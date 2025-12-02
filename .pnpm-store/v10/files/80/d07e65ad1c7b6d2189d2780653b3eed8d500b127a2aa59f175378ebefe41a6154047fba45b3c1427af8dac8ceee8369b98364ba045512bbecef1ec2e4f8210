"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
/* eslint-disable max-classes-per-file */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechConfigImpl = exports.SpeechConfig = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Speech configuration.
 * @class SpeechConfig
 */
class SpeechConfig {
    /**
     * Creates and initializes an instance.
     * @constructor
     */
    constructor() {
        return;
    }
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
    static fromSubscription(subscriptionKey, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(subscriptionKey, "subscriptionKey");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const speechImpl = new SpeechConfigImpl();
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, region);
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_IntentRegion, region);
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, subscriptionKey);
        return speechImpl;
    }
    /**
     * Internal implementation of fromEndpoint() overloads. Accepts either a subscription key or a TokenCredential.
     * @private
     */
    static fromEndpoint(endpoint, auth) {
        Contracts_js_1.Contracts.throwIfNull(endpoint, "endpoint");
        const isValidString = typeof auth === "string" && auth.trim().length > 0;
        const isTokenCredential = typeof auth === "object" && auth !== null && typeof auth.getToken === "function";
        const isKeyCredential = typeof auth === "object" && auth !== null && typeof auth.key === "string";
        if (auth !== undefined && !isValidString && !isTokenCredential && !isKeyCredential) {
            throw new Error("Invalid 'auth' parameter: expected a non-empty API key string, a TokenCredential, or a KeyCredential.");
        }
        let speechImpl;
        if (typeof auth === "string") {
            speechImpl = new SpeechConfigImpl();
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, auth);
        }
        else if (typeof auth === "object" && typeof auth.getToken === "function") {
            speechImpl = new SpeechConfigImpl(auth);
        }
        else if (typeof auth === "object" && typeof auth.key === "string") {
            speechImpl = new SpeechConfigImpl();
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, auth.key);
        }
        else {
            speechImpl = new SpeechConfigImpl();
        }
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, endpoint.href);
        return speechImpl;
    }
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
    static fromHost(hostName, subscriptionKey) {
        Contracts_js_1.Contracts.throwIfNull(hostName, "hostName");
        const speechImpl = new SpeechConfigImpl();
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, hostName.protocol + "//" + hostName.hostname + (hostName.port === "" ? "" : ":" + hostName.port));
        // Containers do not yet have /stt/speech/universal/v2 routes.
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, "1");
        if (undefined !== subscriptionKey) {
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, subscriptionKey);
        }
        return speechImpl;
    }
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
    static fromAuthorizationToken(authorizationToken, region) {
        Contracts_js_1.Contracts.throwIfNull(authorizationToken, "authorizationToken");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const speechImpl = new SpeechConfigImpl();
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, region);
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_IntentRegion, region);
        speechImpl.authorizationToken = authorizationToken;
        return speechImpl;
    }
    /**
     * Closes the configuration.
     * @member SpeechConfig.prototype.close
     * @function
     * @public
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    close() { }
}
exports.SpeechConfig = SpeechConfig;
/**
 * @public
 * @class SpeechConfigImpl
 */
class SpeechConfigImpl extends SpeechConfig {
    constructor(tokenCredential) {
        super();
        this.privProperties = new Exports_js_2.PropertyCollection();
        this.speechRecognitionLanguage = "en-US"; // Should we have a default?
        this.outputFormat = Exports_js_2.OutputFormat.Simple;
        this.privTokenCredential = tokenCredential;
    }
    get properties() {
        return this.privProperties;
    }
    get endPoint() {
        return new URL(this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint));
    }
    get subscriptionKey() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key);
    }
    get region() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region);
    }
    get authorizationToken() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token);
    }
    set authorizationToken(value) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, value);
    }
    get speechRecognitionLanguage() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage);
    }
    set speechRecognitionLanguage(value) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, value);
    }
    get autoDetectSourceLanguages() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages);
    }
    set autoDetectSourceLanguages(value) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, value);
    }
    get outputFormat() {
        return Exports_js_2.OutputFormat[this.privProperties.getProperty(Exports_js_1.OutputFormatPropertyName, undefined)];
    }
    set outputFormat(value) {
        this.privProperties.setProperty(Exports_js_1.OutputFormatPropertyName, Exports_js_2.OutputFormat[value]);
    }
    get endpointId() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId);
    }
    set endpointId(value) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId, value);
    }
    get tokenCredential() {
        return this.privTokenCredential;
    }
    setProperty(name, value) {
        Contracts_js_1.Contracts.throwIfNull(value, "value");
        this.privProperties.setProperty(name, value);
    }
    getProperty(name, def) {
        return this.privProperties.getProperty(name, def);
    }
    setProxy(proxyHostName, proxyPort, proxyUserName, proxyPassword) {
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyHostName], proxyHostName);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyPort], proxyPort);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyUserName], proxyUserName);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyPassword], proxyPassword);
    }
    setServiceProperty(name, value) {
        const currentProperties = JSON.parse(this.privProperties.getProperty(Exports_js_1.ServicePropertiesPropertyName, "{}"));
        currentProperties[name] = value;
        this.privProperties.setProperty(Exports_js_1.ServicePropertiesPropertyName, JSON.stringify(currentProperties));
    }
    setProfanity(profanity) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_ProfanityOption, Exports_js_2.ProfanityOption[profanity]);
    }
    enableAudioLogging() {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EnableAudioLogging, "true");
    }
    requestWordLevelTimestamps() {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "true");
        this.privProperties.setProperty(Exports_js_1.OutputFormatPropertyName, Exports_js_2.OutputFormat[Exports_js_2.OutputFormat.Detailed]);
    }
    enableDictation() {
        this.privProperties.setProperty(Exports_js_1.ForceDictationPropertyName, "true");
    }
    clone() {
        const ret = new SpeechConfigImpl(this.tokenCredential);
        ret.privProperties = this.privProperties.clone();
        return ret;
    }
    get speechSynthesisLanguage() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthLanguage);
    }
    set speechSynthesisLanguage(language) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthLanguage, language);
    }
    get speechSynthesisVoiceName() {
        return this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthVoice);
    }
    set speechSynthesisVoiceName(voice) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthVoice, voice);
    }
    get speechSynthesisOutputFormat() {
        return Exports_js_2.SpeechSynthesisOutputFormat[this.privProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthOutputFormat, undefined)];
    }
    set speechSynthesisOutputFormat(format) {
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthOutputFormat, Exports_js_2.SpeechSynthesisOutputFormat[format]);
    }
}
exports.SpeechConfigImpl = SpeechConfigImpl;

//# sourceMappingURL=SpeechConfig.js.map
