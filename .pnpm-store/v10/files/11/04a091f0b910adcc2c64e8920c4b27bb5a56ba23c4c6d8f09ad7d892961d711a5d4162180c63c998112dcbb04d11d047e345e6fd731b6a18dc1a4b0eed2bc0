"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeechRecognitionResult = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines result of speech recognition.
 * @class SpeechRecognitionResult
 */
class SpeechRecognitionResult extends Exports_js_1.RecognitionResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @public
     * @param {string} resultId - The result id.
     * @param {ResultReason} reason - The reason.
     * @param {string} text - The recognized text.
     * @param {number} duration - The duration.
     * @param {number} offset - The offset into the stream.
     * @param {string} language - Primary Language detected, if provided.
     * @param {string} languageDetectionConfidence - Primary Language confidence ("Unknown," "Low," "Medium," "High"...), if provided.
     * @param {string} speakerId - speaker id for conversation transcription, if provided.
     * @param {string} errorDetails - Error details, if provided.
     * @param {string} json - Additional Json, if provided.
     * @param {PropertyCollection} properties - Additional properties, if provided.
     */
    constructor(resultId, reason, text, duration, offset, language, languageDetectionConfidence, speakerId, errorDetails, json, properties) {
        super(resultId, reason, text, duration, offset, language, languageDetectionConfidence, errorDetails, json, properties);
        this.privSpeakerId = speakerId;
    }
    /**
     * speaker id from conversation transcription/id scenarios
     * @member SpeechRecognitionResult.prototype.speakerId
     * @function
     * @public
     * @returns {string} id of speaker in given result
     */
    get speakerId() {
        return this.privSpeakerId;
    }
}
exports.SpeechRecognitionResult = SpeechRecognitionResult;

//# sourceMappingURL=SpeechRecognitionResult.js.map
