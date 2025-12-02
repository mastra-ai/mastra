"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecognitionResult = void 0;
/**
 * Defines result of speech recognition.
 * @class RecognitionResult
 */
class RecognitionResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
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
    constructor(resultId, reason, text, duration, offset, language, languageDetectionConfidence, errorDetails, json, properties) {
        this.privResultId = resultId;
        this.privReason = reason;
        this.privText = text;
        this.privDuration = duration;
        this.privOffset = offset;
        this.privLanguage = language;
        this.privLanguageDetectionConfidence = languageDetectionConfidence;
        this.privErrorDetails = errorDetails;
        this.privJson = json;
        this.privProperties = properties;
    }
    /**
     * Specifies the result identifier.
     * @member RecognitionResult.prototype.resultId
     * @function
     * @public
     * @returns {string} Specifies the result identifier.
     */
    get resultId() {
        return this.privResultId;
    }
    /**
     * Specifies status of the result.
     * @member RecognitionResult.prototype.reason
     * @function
     * @public
     * @returns {ResultReason} Specifies status of the result.
     */
    get reason() {
        return this.privReason;
    }
    /**
     * Presents the recognized text in the result.
     * @member RecognitionResult.prototype.text
     * @function
     * @public
     * @returns {string} Presents the recognized text in the result.
     */
    get text() {
        return this.privText;
    }
    /**
     * Duration of recognized speech in 100 nano second increments.
     * @member RecognitionResult.prototype.duration
     * @function
     * @public
     * @returns {number} Duration of recognized speech in 100 nano second increments.
     */
    get duration() {
        return this.privDuration;
    }
    /**
     * Offset of recognized speech in 100 nano second increments.
     * @member RecognitionResult.prototype.offset
     * @function
     * @public
     * @returns {number} Offset of recognized speech in 100 nano second increments.
     */
    get offset() {
        return this.privOffset;
    }
    /**
     * Primary Language detected.
     * @member RecognitionResult.prototype.language
     * @function
     * @public
     * @returns {string} language detected.
     */
    get language() {
        return this.privLanguage;
    }
    /**
     * Primary Language detection confidence (Unknown, Low, Medium, High).
     * @member RecognitionResult.prototype.languageDetectionConfidence
     * @function
     * @public
     * @returns {string} detection confidence strength.
     */
    get languageDetectionConfidence() {
        return this.privLanguageDetectionConfidence;
    }
    /**
     * In case of an unsuccessful recognition, provides details of the occurred error.
     * @member RecognitionResult.prototype.errorDetails
     * @function
     * @public
     * @returns {string} a brief description of an error.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
    /**
     * A string containing Json serialized recognition result as it was received from the service.
     * @member RecognitionResult.prototype.json
     * @function
     * @private
     * @returns {string} Json serialized representation of the result.
     */
    get json() {
        return this.privJson;
    }
    /**
     * The set of properties exposed in the result.
     * @member RecognitionResult.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The set of properties exposed in the result.
     */
    get properties() {
        return this.privProperties;
    }
}
exports.RecognitionResult = RecognitionResult;

//# sourceMappingURL=RecognitionResult.js.map
