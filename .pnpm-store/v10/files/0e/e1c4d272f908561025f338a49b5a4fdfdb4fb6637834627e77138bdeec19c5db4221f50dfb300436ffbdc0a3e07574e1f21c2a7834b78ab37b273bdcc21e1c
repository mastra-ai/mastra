import { PropertyCollection, ResultReason, SynthesisResult } from "./Exports.js";
/**
 * Defines result of speech synthesis.
 * @class SpeechSynthesisResult
 * Added in version 1.11.0
 */
export declare class SpeechSynthesisResult extends SynthesisResult {
    private readonly privAudioData;
    private readonly privAudioDuration;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} resultId - The result id.
     * @param {ResultReason} reason - The reason.
     * @param {ArrayBuffer} audioData - The synthesized audio binary.
     * @param {string} errorDetails - Error details, if provided.
     * @param {PropertyCollection} properties - Additional properties, if provided.
     * @param {number} audioDuration - The audio duration.
     */
    constructor(resultId?: string, reason?: ResultReason, audioData?: ArrayBuffer, errorDetails?: string, properties?: PropertyCollection, audioDuration?: number);
    /**
     * The synthesized audio data
     * @member SpeechSynthesisResult.prototype.audioData
     * @function
     * @public
     * @returns {ArrayBuffer} The synthesized audio data.
     */
    get audioData(): ArrayBuffer;
    /**
     * The time duration of synthesized audio, in ticks (100 nanoseconds).
     * @member SpeechSynthesisResult.prototype.audioDuration
     * @function
     * @public
     * @returns {number} The time duration of synthesized audio.
     */
    get audioDuration(): number;
}
