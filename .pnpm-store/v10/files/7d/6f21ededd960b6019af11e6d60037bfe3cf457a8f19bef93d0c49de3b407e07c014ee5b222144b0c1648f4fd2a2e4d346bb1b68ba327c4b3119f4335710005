"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoDetectSourceLanguageConfig = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_2 = require("./Exports.js");
const LanguageIdMode_js_1 = require("./LanguageIdMode.js");
/**
 * Language auto detect configuration.
 * @class AutoDetectSourceLanguageConfig
 * Added in version 1.13.0.
 */
class AutoDetectSourceLanguageConfig {
    constructor() {
        this.privProperties = new Exports_js_2.PropertyCollection();
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_LanguageIdMode, "AtStart");
        this.privLanguageIdMode = LanguageIdMode_js_1.LanguageIdMode.AtStart;
    }
    /**
     * @member AutoDetectSourceLanguageConfig.fromOpenRange
     * @function
     * @public
     * Only [[SpeechSynthesizer]] supports source language auto detection from open range,
     * for [[Recognizer]], please use AutoDetectSourceLanguageConfig with specific source languages.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with open range.
     */
    static fromOpenRange() {
        const config = new AutoDetectSourceLanguageConfig();
        config.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, Exports_js_1.AutoDetectSourceLanguagesOpenRangeOptionName);
        config.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecoLanguage, "en-US");
        return config;
    }
    /**
     * @member AutoDetectSourceLanguageConfig.fromLanguages
     * @function
     * @public
     * @param {string[]} languages Comma-separated string of languages (eg. "en-US,fr-FR") to populate properties of config.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with given languages.
     */
    static fromLanguages(languages) {
        Contracts_js_1.Contracts.throwIfArrayEmptyOrWhitespace(languages, "languages");
        const config = new AutoDetectSourceLanguageConfig();
        config.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, languages.join());
        return config;
    }
    /**
     * @member AutoDetectSourceLanguageConfig.fromSourceLanguageConfigs
     * @function
     * @public
     * @param {SourceLanguageConfig[]} configs SourceLanguageConfigs to populate properties of config.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with given SourceLanguageConfigs.
     */
    static fromSourceLanguageConfigs(configs) {
        if (configs.length < 1) {
            throw new Error("Expected non-empty SourceLanguageConfig array.");
        }
        const autoConfig = new AutoDetectSourceLanguageConfig();
        const langs = [];
        configs.forEach((config) => {
            langs.push(config.language);
            if (config.endpointId !== undefined && config.endpointId !== "") {
                const customProperty = config.language + Exports_js_2.PropertyId.SpeechServiceConnection_EndpointId.toString();
                autoConfig.properties.setProperty(customProperty, config.endpointId);
            }
        });
        autoConfig.properties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_AutoDetectSourceLanguages, langs.join());
        return autoConfig;
    }
    /**
     * @member AutoDetectSourceLanguageConfig.prototype.properties
     * @function
     * @public
     * @return {PropertyCollection} Properties of the config.
     * @summary Gets an auto detected language config properties
     */
    get properties() {
        return this.privProperties;
    }
    /**
     * @member AutoDetectSourceLanguageConfig.prototype.mode
     * @function
     * @public
     * @param {LanguageIdMode} mode LID mode desired.
     * @summary Sets LID operation to desired mode
     */
    set mode(mode) {
        if (mode === LanguageIdMode_js_1.LanguageIdMode.Continuous) {
            this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, "2");
            this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous");
        }
        else { // LanguageIdMode.AtStart
            this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_RecognitionEndpointVersion, "1");
            this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceConnection_LanguageIdMode, "AtStart");
        }
        this.privLanguageIdMode = mode;
    }
}
exports.AutoDetectSourceLanguageConfig = AutoDetectSourceLanguageConfig;

//# sourceMappingURL=AutoDetectSourceLanguageConfig.js.map
