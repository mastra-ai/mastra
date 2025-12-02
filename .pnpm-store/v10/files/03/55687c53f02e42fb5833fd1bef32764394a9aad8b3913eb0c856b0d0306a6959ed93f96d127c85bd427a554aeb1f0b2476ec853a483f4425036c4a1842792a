"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechSynthesisResult = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines result of speech synthesis.
 * @class SpeechSynthesisResult
 * Added in version 1.11.0
 */
class SpeechSynthesisResult extends Exports_js_1.SynthesisResult {
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
    constructor(resultId, reason, audioData, errorDetails, properties, audioDuration) {
        super(resultId, reason, errorDetails, properties);
        this.privAudioData = audioData;
        this.privAudioDuration = audioDuration;
    }
    /**
     * The synthesized audio data
     * @member SpeechSynthesisResult.prototype.audioData
     * @function
     * @public
     * @returns {ArrayBuffer} The synthesized audio data.
     */
    get audioData() {
        return this.privAudioData;
    }
    /**
     * The time duration of synthesized audio, in ticks (100 nanoseconds).
     * @member SpeechSynthesisResult.prototype.audioDuration
     * @function
     * @public
     * @returns {number} The time duration of synthesized audio.
     */
    get audioDuration() {
        return this.privAudioDuration;
    }
}
exports.SpeechSynthesisResult = SpeechSynthesisResult;

//# sourceMappingURL=SpeechSynthesisResult.js.map
