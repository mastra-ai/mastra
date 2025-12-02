import { ResultReason } from "./ResultReason.js";
/**
 * Defines translation synthesis result, i.e. the voice output of the translated
 * text in the target language.
 * @class TranslationSynthesisResult
 */
export declare class TranslationSynthesisResult {
    private privReason;
    private privAudio;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {ResultReason} reason - The synthesis reason.
     * @param {ArrayBuffer} audio - The audio data.
     */
    constructor(reason: ResultReason, audio: ArrayBuffer);
    /**
     * Translated text in the target language.
     * @member TranslationSynthesisResult.prototype.audio
     * @function
     * @public
     * @returns {ArrayBuffer} Translated audio in the target language.
     */
    get audio(): ArrayBuffer;
    /**
     * The synthesis status.
     * @member TranslationSynthesisResult.prototype.reason
     * @function
     * @public
     * @returns {ResultReason} The synthesis status.
     */
    get reason(): ResultReason;
}
