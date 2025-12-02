import { RecognitionResult } from "./Exports.js";
interface DetailResult {
    Words: WordResult[];
    PronunciationAssessment: {
        AccuracyScore: number;
        CompletenessScore: number;
        FluencyScore: number;
        PronScore: number;
        ProsodyScore: number;
    };
}
interface WordResult {
    Word: string;
    Phonemes: {
        Phoneme?: string;
        PronunciationAssessment?: {
            NBestPhonemes: {
                Phoneme: string;
            }[];
        };
    }[];
    PronunciationAssessment?: {
        AccuracyScore: number;
        ErrorType: string;
    };
    Syllables: {
        Syllable: string;
    }[];
}
/**
 * Pronunciation assessment results.
 * @class PronunciationAssessmentResult
 * Added in version 1.15.0.
 */
export declare class PronunciationAssessmentResult {
    private privPronJson;
    private constructor();
    /**
     * @member PronunciationAssessmentResult.fromResult
     * @function
     * @public
     * @param {RecognitionResult} result The recognition result.
     * @return {PronunciationAssessmentConfig} Instance of PronunciationAssessmentConfig
     * @summary Creates an instance of the PronunciationAssessmentResult from recognition result.
     */
    static fromResult(result: RecognitionResult): PronunciationAssessmentResult;
    /**
     * Gets the detail result of pronunciation assessment.
     * @member PronunciationAssessmentConfig.prototype.detailResult
     * @function
     * @public
     * @returns {DetailResult} detail result.
     */
    get detailResult(): DetailResult;
    /**
     * The score indicating the pronunciation accuracy of the given speech, which indicates
     * how closely the phonemes match a native speaker's pronunciation.
     * @member PronunciationAssessmentResult.prototype.accuracyScore
     * @function
     * @public
     * @returns {number} Accuracy score.
     */
    get accuracyScore(): number;
    /**
     * The overall score indicating the pronunciation quality of the given speech.
     * This is calculated from AccuracyScore, FluencyScore and CompletenessScore with weight.
     * @member PronunciationAssessmentResult.prototype.pronunciationScore
     * @function
     * @public
     * @returns {number} Pronunciation score.
     */
    get pronunciationScore(): number;
    /**
     * The score indicating the completeness of the given speech by calculating the ratio of pronounced words towards entire input.
     * @member PronunciationAssessmentResult.prototype.completenessScore
     * @function
     * @public
     * @returns {number} Completeness score.
     */
    get completenessScore(): number;
    /**
     * The score indicating the fluency of the given speech.
     * @member PronunciationAssessmentResult.prototype.fluencyScore
     * @function
     * @public
     * @returns {number} Fluency score.
     */
    get fluencyScore(): number;
    /**
     * The prosody score, which indicates how nature of the given speech, including stress, intonation, speaking speed and rhythm.
     * @member PronunciationAssessmentResult.prototype.prosodyScore
     * @function
     * @public
     * @returns {number} Prosody score.
     */
    get prosodyScore(): number;
}
export {};
