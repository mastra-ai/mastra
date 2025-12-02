import { PronunciationAssessmentGradingSystem, PronunciationAssessmentGranularity, PropertyCollection, Recognizer } from "./Exports.js";
/**
 * Pronunciation assessment configuration.
 * @class PronunciationAssessmentConfig
 * Added in version 1.15.0.
 */
export declare class PronunciationAssessmentConfig {
    private privProperties;
    private privPhonemeAlphabet;
    private privNBestPhonemeCount;
    private privEnableProsodyAssessment;
    /**
     * PronunciationAssessmentConfig constructor.
     * @constructor
     * @param {string} referenceText
     * @param gradingSystem
     * @param granularity
     * @param enableMiscue
     */
    constructor(referenceText: string, gradingSystem?: PronunciationAssessmentGradingSystem, granularity?: PronunciationAssessmentGranularity, enableMiscue?: boolean);
    /**
     * @member PronunciationAssessmentConfig.fromJSON
     * @function
     * @public
     * @param {string} json The json string containing the pronunciation assessment parameters.
     * @return {PronunciationAssessmentConfig} Instance of PronunciationAssessmentConfig
     * @summary Creates an instance of the PronunciationAssessmentConfig from json.
     * This method is designed to support the pronunciation assessment parameters still in preview.
     * Under normal circumstances, use the constructor instead.
     */
    static fromJSON(json: string): PronunciationAssessmentConfig;
    toJSON(): string;
    applyTo(recognizer: Recognizer): void;
    /**
     * Gets the reference text.
     * @member PronunciationAssessmentConfig.prototype.referenceText
     * @function
     * @public
     * @returns {string} Reference text.
     */
    get referenceText(): string;
    /**
     * Gets/Sets the reference text.
     * @member PronunciationAssessmentConfig.prototype.referenceText
     * @function
     * @public
     * @param {string} referenceText - Reference text.
     */
    set referenceText(referenceText: string);
    /**
     * Sets the phoneme alphabet.
     * The valid values are "SAPI" (default) and "IPA".
     * Added in version 1.20.0
     * @member PronunciationAssessmentConfig.prototype.phonemeAlphabet
     * @function
     * @public
     * @param {string} phonemeAlphabet - Phoneme alphabet.
     */
    set phonemeAlphabet(phonemeAlphabet: string);
    /**
     * Sets the boolean enableMiscue property.
     * Added in version 1.26.0
     * @member PronunciationAssessmentConfig.prototype.enableMiscue
     * @function
     * @public
     * @param {boolean} enableMiscue - enable miscue.
     */
    set enableMiscue(enableMiscue: boolean);
    /**
     * Gets the boolean enableMiscue property.
     * Added in version 1.26.0
     * @member PronunciationAssessmentConfig.prototype.enableMiscue
     * @function
     * @public
     * @return {boolean} enableMiscue - enable miscue.
     */
    get enableMiscue(): boolean;
    /**
     * Sets the nbest phoneme count
     * Added in version 1.20.0
     * @member PronunciationAssessmentConfig.prototype.nbestPhonemeCount
     * @function
     * @public
     * @param {number} nbestPhonemeCount - NBest phoneme count.
     */
    set nbestPhonemeCount(nbestPhonemeCount: number);
    /**
     * Enables the prosody assessment.
     * Added in version 1.34.0
     * @member PronunciationAssessmentConfig.prototype.enableProsodyAssessment
     * @function
     * @public
     * @param {boolean} enableProsodyAssessment - enable prosody assessment.
     */
    set enableProsodyAssessment(enableProsodyAssessment: boolean);
    /**
     * @member PronunciationAssessmentConfig.prototype.properties
     * @function
     * @public
     * @return {PropertyCollection} Properties of the config.
     * @summary Gets a pronunciation assessment config properties
     */
    get properties(): PropertyCollection;
    private updateJson;
}
