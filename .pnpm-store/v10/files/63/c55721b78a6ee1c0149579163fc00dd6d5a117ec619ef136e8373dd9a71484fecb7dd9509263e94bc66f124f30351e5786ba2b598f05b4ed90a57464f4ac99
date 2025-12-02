"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntentRecognitionResult = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Intent recognition result.
 * @class
 */
class IntentRecognitionResult extends Exports_js_1.SpeechRecognitionResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param intentId - The intent id.
     * @param resultId - The result id.
     * @param reason - The reason.
     * @param text - The recognized text.
     * @param duration - The duration.
     * @param offset - The offset into the stream.
     * @param language - Primary Language detected, if provided.
     * @param languageDetectionConfidence - Primary Language confidence ("Unknown," "Low," "Medium," "High"...), if provided.
     * @param errorDetails - Error details, if provided.
     * @param json - Additional Json, if provided.
     * @param properties - Additional properties, if provided.
     */
    constructor(intentId, resultId, reason, text, duration, offset, language, languageDetectionConfidence, errorDetails, json, properties) {
        super(resultId, reason, text, duration, offset, language, languageDetectionConfidence, undefined, errorDetails, json, properties);
        this.privIntentId = intentId;
    }
    /**
     * A String that represents the intent identifier being recognized.
     * @member IntentRecognitionResult.prototype.intentId
     * @function
     * @public
     * @returns {string} A String that represents the intent identifier being recognized.
     */
    get intentId() {
        return this.privIntentId;
    }
}
exports.IntentRecognitionResult = IntentRecognitionResult;

//# sourceMappingURL=IntentRecognitionResult.js.map
