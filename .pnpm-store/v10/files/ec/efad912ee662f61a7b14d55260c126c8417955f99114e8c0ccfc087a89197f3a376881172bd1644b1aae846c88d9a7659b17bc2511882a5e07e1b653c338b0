"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PronunciationAssessmentResult = void 0;
/* eslint-disable max-classes-per-file */
const Contracts_js_1 = require("./Contracts.js");
const Exports_js_1 = require("./Exports.js");
/**
 * Pronunciation assessment results.
 * @class PronunciationAssessmentResult
 * Added in version 1.15.0.
 */
class PronunciationAssessmentResult {
    constructor(jsonString) {
        const j = JSON.parse(jsonString);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(j.NBest[0], "NBest");
        this.privPronJson = j.NBest[0];
    }
    /**
     * @member PronunciationAssessmentResult.fromResult
     * @function
     * @public
     * @param {RecognitionResult} result The recognition result.
     * @return {PronunciationAssessmentConfig} Instance of PronunciationAssessmentConfig
     * @summary Creates an instance of the PronunciationAssessmentResult from recognition result.
     */
    static fromResult(result) {
        Contracts_js_1.Contracts.throwIfNullOrUndefined(result, "result");
        const json = result.properties.getProperty(Exports_js_1.PropertyId.SpeechServiceResponse_JsonResult);
        Contracts_js_1.Contracts.throwIfNullOrUndefined(json, "json");
        return new PronunciationAssessmentResult(json);
    }
    /**
     * Gets the detail result of pronunciation assessment.
     * @member PronunciationAssessmentConfig.prototype.detailResult
     * @function
     * @public
     * @returns {DetailResult} detail result.
     */
    get detailResult() {
        return this.privPronJson;
    }
    /**
     * The score indicating the pronunciation accuracy of the given speech, which indicates
     * how closely the phonemes match a native speaker's pronunciation.
     * @member PronunciationAssessmentResult.prototype.accuracyScore
     * @function
     * @public
     * @returns {number} Accuracy score.
     */
    get accuracyScore() {
        return this.detailResult.PronunciationAssessment?.AccuracyScore;
    }
    /**
     * The overall score indicating the pronunciation quality of the given speech.
     * This is calculated from AccuracyScore, FluencyScore and CompletenessScore with weight.
     * @member PronunciationAssessmentResult.prototype.pronunciationScore
     * @function
     * @public
     * @returns {number} Pronunciation score.
     */
    get pronunciationScore() {
        return this.detailResult.PronunciationAssessment?.PronScore;
    }
    /**
     * The score indicating the completeness of the given speech by calculating the ratio of pronounced words towards entire input.
     * @member PronunciationAssessmentResult.prototype.completenessScore
     * @function
     * @public
     * @returns {number} Completeness score.
     */
    get completenessScore() {
        return this.detailResult.PronunciationAssessment?.CompletenessScore;
    }
    /**
     * The score indicating the fluency of the given speech.
     * @member PronunciationAssessmentResult.prototype.fluencyScore
     * @function
     * @public
     * @returns {number} Fluency score.
     */
    get fluencyScore() {
        return this.detailResult.PronunciationAssessment?.FluencyScore;
    }
    /**
     * The prosody score, which indicates how nature of the given speech, including stress, intonation, speaking speed and rhythm.
     * @member PronunciationAssessmentResult.prototype.prosodyScore
     * @function
     * @public
     * @returns {number} Prosody score.
     */
    get prosodyScore() {
        return this.detailResult.PronunciationAssessment?.ProsodyScore;
    }
}
exports.PronunciationAssessmentResult = PronunciationAssessmentResult;

//# sourceMappingURL=PronunciationAssessmentResult.js.map
