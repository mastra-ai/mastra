"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechTranslationConfigImpl = exports.SpeechTranslationConfig = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Speech translation configuration.
 * @class SpeechTranslationConfig
 */
class SpeechTranslationConfig extends Exports_js_2.SpeechConfig {
    /**
     * Creates an instance of recognizer config.
     */
    constructor() {
        super();
    }
    /**
     * Static instance of SpeechTranslationConfig returned by passing a subscription key and service region.
     * @member SpeechTranslationConfig.fromSubscription
     * @function
     * @public
     * @param {string} subscriptionKey - The subscription key.
     * @param {string} region - The region name (see the <a href="https://aka.ms/csspeech/region">region page</a>).
     * @returns {SpeechTranslationConfig} The speech translation config.
     */
    static fromSubscription(subscriptionKey, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(subscriptionKey, "subscriptionKey");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const ret = new SpeechTranslationConfigImpl();
        ret.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, subscriptionKey);
        ret.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, region);
        return ret;
    }
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
    static fromAuthorizationToken(authorizationToken, region) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(authorizationToken, "authorizationToken");
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(region, "region");
        const ret = new SpeechTranslationConfigImpl();
        ret.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, authorizationToken);
        ret.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region, region);
        return ret;
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
        const speechImpl = new SpeechTranslationConfigImpl();
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Host, hostName.protocol + "//" + hostName.hostname + (hostName.port === "" ? "" : ":" + hostName.port));
        if (undefined !== subscriptionKey) {
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, subscriptionKey);
        }
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
            speechImpl = new SpeechTranslationConfigImpl();
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, auth);
        }
        else if (typeof auth === "object" && typeof auth.getToken === "function") {
            speechImpl = new SpeechTranslationConfigImpl(auth);
        }
        else if (typeof auth === "object" && typeof auth.key === "string") {
            speechImpl = new SpeechTranslationConfigImpl();
            speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Key, auth.key);
        }
        else {
            speechImpl = new SpeechTranslationConfigImpl();
        }
        speechImpl.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Endpoint, endpoint.href);
        return speechImpl;
    }
}
exports.SpeechTranslationConfig = SpeechTranslationConfig;
/**
 * @private
 * @class SpeechTranslationConfigImpl
 */
class SpeechTranslationConfigImpl extends SpeechTranslationConfig {
    constructor(tokenCredential) {
        super();
        this.privSpeechProperties = new Exports_js_2.PropertyCollection();
        this.outputFormat = Exports_js_2.OutputFormat.Simple;
        this.privTokenCredential = tokenCredential;
    }
    /**
     * Gets/Sets the authorization token.
     * If this is set, subscription key is ignored.
     * User needs to make sure the provided authorization token is valid and not expired.
     * @member SpeechTranslationConfigImpl.prototype.authorizationToken
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    set authorizationToken(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceAuthorization_Token, value);
    }
    /**
     * Sets the speech recognition language.
     * @member SpeechTranslationConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @param {string} value - The authorization token.
     */
    set speechRecognitionLanguage(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, value);
    }
    /**
     * Gets the speech recognition language.
     * @member SpeechTranslationConfigImpl.prototype.speechRecognitionLanguage
     * @function
     * @public
     * @return {string} The speechRecognitionLanguage.
     */
    get speechRecognitionLanguage() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage]);
    }
    /**
     * @member SpeechTranslationConfigImpl.prototype.subscriptionKey
     * @function
     * @public
     */
    get subscriptionKey() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_Key]);
    }
    /**
     * Gets the output format
     * @member SpeechTranslationConfigImpl.prototype.outputFormat
     * @function
     * @public
     */
    get outputFormat() {
        // eslint-disable-next-line
        return Exports_js_2.OutputFormat[this.privSpeechProperties.getProperty(Exports_js_1.OutputFormatPropertyName, undefined)];
    }
    /**
     * Gets/Sets the output format
     * @member SpeechTranslationConfigImpl.prototype.outputFormat
     * @function
     * @public
     */
    set outputFormat(value) {
        this.privSpeechProperties.setProperty(Exports_js_1.OutputFormatPropertyName, Exports_js_2.OutputFormat[value]);
    }
    /**
     * Gets the endpoint id.
     * @member SpeechTranslationConfigImpl.prototype.endpointId
     * @function
     * @public
     */
    get endpointId() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId);
    }
    /**
     * Gets/Sets the endpoint id.
     * @member SpeechTranslationConfigImpl.prototype.endpointId
     * @function
     * @public
     */
    set endpointId(value) {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId, value);
    }
    /**
     * Add a (text) target language to translate into.
     * @member SpeechTranslationConfigImpl.prototype.addTargetLanguage
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    addTargetLanguage(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        const languages = this.targetLanguages;
        if (!languages.includes(value)) {
            languages.push(value);
            this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationToLanguages, languages.join(","));
        }
    }
    /**
     * Gets the (text) target language to translate into.
     * @member SpeechTranslationConfigImpl.prototype.targetLanguages
     * @function
     * @public
     * @param {string} value - The language such as de-DE
     */
    get targetLanguages() {
        if (this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationToLanguages, undefined) !== undefined) {
            return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationToLanguages).split(",");
        }
        else {
            return [];
        }
    }
    /**
     * Gets the voice name.
     * @member SpeechTranslationConfigImpl.prototype.voiceName
     * @function
     * @public
     */
    get voiceName() {
        return this.getProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_TranslationVoice]);
    }
    /**
     * Gets/Sets the voice of the translated language, enable voice synthesis output.
     * @member SpeechTranslationConfigImpl.prototype.voiceName
     * @function
     * @public
     * @param {string} value - The name of the voice.
     */
    set voiceName(value) {
        Contracts_js_1.Contracts.throwIfNullOrWhitespace(value, "value");
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_TranslationVoice, value);
    }
    /**
     * Provides the region.
     * @member SpeechTranslationConfigImpl.prototype.region
     * @function
     * @public
     * @returns {string} The region.
     */
    get region() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_Region);
    }
    get tokenCredential() {
        return this.privTokenCredential;
    }
    setProxy(proxyHostName, proxyPort, proxyUserName, proxyPassword) {
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyHostName], proxyHostName);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyPort], proxyPort);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyUserName], proxyUserName);
        this.setProperty(Exports_js_2.PropertyId[Exports_js_2.PropertyId.SpeechServiceConnection_ProxyPassword], proxyPassword);
    }
    /**
     * Gets an arbitrary property value.
     * @member SpeechTranslationConfigImpl.prototype.getProperty
     * @function
     * @public
     * @param {string} name - The name of the property.
     * @param {string} def - The default value of the property in case it is not set.
     * @returns {string} The value of the property.
     */
    getProperty(name, def) {
        return this.privSpeechProperties.getProperty(name, def);
    }
    /**
     * Gets/Sets an arbitrary property value.
     * @member SpeechTranslationConfigImpl.prototype.setProperty
     * @function
     * @public
     * @param {string | PropertyId} name - The name of the property to set.
     * @param {string} value - The value of the property.
     */
    setProperty(name, value) {
        this.privSpeechProperties.setProperty(name, value);
    }
    /**
     * Provides access to custom properties.
     * @member SpeechTranslationConfigImpl.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The properties.
     */
    get properties() {
        return this.privSpeechProperties;
    }
    /**
     * Dispose of associated resources.
     * @member SpeechTranslationConfigImpl.prototype.close
     * @function
     * @public
     */
    close() {
        return;
    }
    setServiceProperty(name, value) {
        const currentProperties = JSON.parse(this.privSpeechProperties.getProperty(Exports_js_1.ServicePropertiesPropertyName, "{}"));
        currentProperties[name] = value;
        this.privSpeechProperties.setProperty(Exports_js_1.ServicePropertiesPropertyName, JSON.stringify(currentProperties));
    }
    setProfanity(profanity) {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_ProfanityOption, Exports_js_2.ProfanityOption[profanity]);
    }
    enableAudioLogging() {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_EnableAudioLogging, "true");
    }
    requestWordLevelTimestamps() {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_RequestWordLevelTimestamps, "true");
    }
    enableDictation() {
        this.privSpeechProperties.setProperty(Exports_js_1.ForceDictationPropertyName, "true");
    }
    get speechSynthesisLanguage() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthLanguage);
    }
    set speechSynthesisLanguage(language) {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthLanguage, language);
    }
    get speechSynthesisVoiceName() {
        return this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthVoice);
    }
    set speechSynthesisVoiceName(voice) {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthVoice, voice);
    }
    get speechSynthesisOutputFormat() {
        // eslint-disable-next-line
        return Exports_js_2.SpeechSynthesisOutputFormat[this.privSpeechProperties.getProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthOutputFormat, undefined)];
    }
    set speechSynthesisOutputFormat(format) {
        this.privSpeechProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_SynthOutputFormat, Exports_js_2.SpeechSynthesisOutputFormat[format]);
    }
}
exports.SpeechTranslationConfigImpl = SpeechTranslationConfigImpl;

//# sourceMappingURL=SpeechTranslationConfig.js.map
