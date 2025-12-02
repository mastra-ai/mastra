import { PropertyCollection, ResultReason, SpeechRecognitionResult, Translations } from "./Exports.js";
/**
 * Translation text result.
 * @class TranslationRecognitionResult
 */
export declare class TranslationRecognitionResult extends SpeechRecognitionResult {
    private privTranslations;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {Translations} translations - The translations.
     * @param {string} resultId - The result id.
     * @param {ResultReason} reason - The reason.
     * @param {string} text - The recognized text.
     * @param {number} duration - The duration.
     * @param {number} offset - The offset into the stream.
     * @param {string} language - Primary Language detected, if provided.
     * @param {string} languageDetectionConfidence - Primary Language confidence ("Unknown," "Low," "Medium," "High"...), if provided.
     * @param {string} errorDetails - Error details, if provided.
     * @param {string} json - Additional Json, if provided.
     * @param {PropertyCollection} properties - Additional properties, if provided.
     */
    constructor(translations: Translations, resultId?: string, reason?: ResultReason, text?: string, duration?: number, offset?: number, language?: string, languageDetectionConfidence?: string, errorDetails?: string, json?: string, properties?: PropertyCollection);
    static fromSpeechRecognitionResult(result: SpeechRecognitionResult): TranslationRecognitionResult;
    /**
     * Presents the translation results. Each item in the dictionary represents
     * a translation result in one of target languages, where the key is the name
     * of the target language, in BCP-47 format, and the value is the translation
     * text in the specified language.
     * @member TranslationRecognitionResult.prototype.translations
     * @function
     * @public
     * @returns {Translations} the current translation map that holds all translations requested.
     */
    get translations(): Translations;
}
