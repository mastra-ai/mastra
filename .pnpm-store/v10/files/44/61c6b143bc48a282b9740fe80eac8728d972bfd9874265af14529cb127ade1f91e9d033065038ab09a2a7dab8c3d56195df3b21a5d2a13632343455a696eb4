import { PropertyCollection, SourceLanguageConfig } from "./Exports.js";
import { LanguageIdMode } from "./LanguageIdMode.js";
/**
 * Language auto detect configuration.
 * @class AutoDetectSourceLanguageConfig
 * Added in version 1.13.0.
 */
export declare class AutoDetectSourceLanguageConfig {
    private privProperties;
    private privLanguageIdMode;
    private constructor();
    /**
     * @member AutoDetectSourceLanguageConfig.fromOpenRange
     * @function
     * @public
     * Only [[SpeechSynthesizer]] supports source language auto detection from open range,
     * for [[Recognizer]], please use AutoDetectSourceLanguageConfig with specific source languages.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with open range.
     */
    static fromOpenRange(): AutoDetectSourceLanguageConfig;
    /**
     * @member AutoDetectSourceLanguageConfig.fromLanguages
     * @function
     * @public
     * @param {string[]} languages Comma-separated string of languages (eg. "en-US,fr-FR") to populate properties of config.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with given languages.
     */
    static fromLanguages(languages: string[]): AutoDetectSourceLanguageConfig;
    /**
     * @member AutoDetectSourceLanguageConfig.fromSourceLanguageConfigs
     * @function
     * @public
     * @param {SourceLanguageConfig[]} configs SourceLanguageConfigs to populate properties of config.
     * @return {AutoDetectSourceLanguageConfig} Instance of AutoDetectSourceLanguageConfig
     * @summary Creates an instance of the AutoDetectSourceLanguageConfig with given SourceLanguageConfigs.
     */
    static fromSourceLanguageConfigs(configs: SourceLanguageConfig[]): AutoDetectSourceLanguageConfig;
    /**
     * @member AutoDetectSourceLanguageConfig.prototype.properties
     * @function
     * @public
     * @return {PropertyCollection} Properties of the config.
     * @summary Gets an auto detected language config properties
     */
    get properties(): PropertyCollection;
    /**
     * @member AutoDetectSourceLanguageConfig.prototype.mode
     * @function
     * @public
     * @param {LanguageIdMode} mode LID mode desired.
     * @summary Sets LID operation to desired mode
     */
    set mode(mode: LanguageIdMode);
}
