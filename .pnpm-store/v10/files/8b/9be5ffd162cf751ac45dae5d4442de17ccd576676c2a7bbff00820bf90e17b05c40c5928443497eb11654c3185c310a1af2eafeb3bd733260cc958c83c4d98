"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AutoDetectSourceLanguageResult = void 0;
const Contracts_js_1 = require("./Contracts.js");
/**
 * Output format
 * @class AutoDetectSourceLanguageResult
 */
class AutoDetectSourceLanguageResult {
    constructor(language, languageDetectionConfidence) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(language, "language");
        Contracts_js_1.Contracts.throwIfNullOrUndefined(languageDetectionConfidence, "languageDetectionConfidence");
        this.privLanguage = language;
        this.privLanguageDetectionConfidence = languageDetectionConfidence;
    }
    /**
     * Creates an instance of AutoDetectSourceLanguageResult object from a SpeechRecognitionResult instance.
     * @member AutoDetectSourceLanguageResult.fromResult
     * @function
     * @public
     * @param {SpeechRecognitionResult} result - The recognition result.
     * @returns {AutoDetectSourceLanguageResult} AutoDetectSourceLanguageResult object being created.
     */
    static fromResult(result) {
        return new AutoDetectSourceLanguageResult(result.language, result.languageDetectionConfidence);
    }
    /**
     * Creates an instance of AutoDetectSourceLanguageResult object from a ConversationTranscriptionResult instance.
     * @member AutoDetectSourceLanguageResult.fromConversationTranscriptionResult
     * @function
     * @public
     * @param {ConversationTranscriptionResult} result - The transcription result.
     * @returns {AutoDetectSourceLanguageResult} AutoDetectSourceLanguageResult object being created.
     */
    static fromConversationTranscriptionResult(result) {
        return new AutoDetectSourceLanguageResult(result.language, result.languageDetectionConfidence);
    }
    get language() {
        return this.privLanguage;
    }
    get languageDetectionConfidence() {
        return this.privLanguageDetectionConfidence;
    }
}
exports.AutoDetectSourceLanguageResult = AutoDetectSourceLanguageResult;

//# sourceMappingURL=AutoDetectSourceLanguageResult.js.map
