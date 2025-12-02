"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SpeakerRecognitionCancellationDetails = exports.SpeakerRecognitionResult = exports.SpeakerRecognitionResultType = void 0;
/* eslint-disable max-classes-per-file */
const Exports_js_1 = require("../common.speech/Exports.js");
const Exports_js_2 = require("./Exports.js");
var SpeakerRecognitionResultType;
(function (SpeakerRecognitionResultType) {
    SpeakerRecognitionResultType[SpeakerRecognitionResultType["Verify"] = 0] = "Verify";
    SpeakerRecognitionResultType[SpeakerRecognitionResultType["Identify"] = 1] = "Identify";
})(SpeakerRecognitionResultType = exports.SpeakerRecognitionResultType || (exports.SpeakerRecognitionResultType = {}));
/**
 * Output format
 * @class SpeakerRecognitionResult
 */
class SpeakerRecognitionResult {
    constructor(response, resultReason = Exports_js_2.ResultReason.RecognizedSpeaker, cancellationErrorCode = Exports_js_2.CancellationErrorCode.NoError, errorDetails = "") {
        this.privProperties = new Exports_js_2.PropertyCollection();
        const resultType = response.scenario === "TextIndependentIdentification" ? SpeakerRecognitionResultType.Identify : SpeakerRecognitionResultType.Verify;
        this.privReason = resultReason;
        if (this.privReason !== Exports_js_2.ResultReason.Canceled) {
            if (resultType === SpeakerRecognitionResultType.Identify) {
                this.privProfileId = response.identificationResult.identifiedProfile.profileId;
                this.privScore = response.identificationResult.identifiedProfile.score;
                this.privReason = Exports_js_2.ResultReason.RecognizedSpeakers;
            }
            else {
                this.privScore = response.verificationResult.score;
                if (response.verificationResult.recognitionResult.toLowerCase() !== "accept") {
                    this.privReason = Exports_js_2.ResultReason.NoMatch;
                }
                if (response.verificationResult.profileId !== undefined && response.verificationResult.profileId !== "") {
                    this.privProfileId = response.verificationResult.profileId;
                }
            }
        }
        else {
            this.privErrorDetails = errorDetails;
            this.privProperties.setProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[cancellationErrorCode]);
        }
        this.privProperties.setProperty(Exports_js_2.PropertyId.SpeechServiceResponse_JsonResult, JSON.stringify(response));
    }
    get properties() {
        return this.privProperties;
    }
    get reason() {
        return this.privReason;
    }
    get profileId() {
        return this.privProfileId;
    }
    get errorDetails() {
        return this.privErrorDetails;
    }
    get score() {
        return this.privScore;
    }
}
exports.SpeakerRecognitionResult = SpeakerRecognitionResult;
/**
 * @class SpeakerRecognitionCancellationDetails
 */
class SpeakerRecognitionCancellationDetails extends Exports_js_2.CancellationDetailsBase {
    constructor(reason, errorDetails, errorCode) {
        super(reason, errorDetails, errorCode);
    }
    /**
     * Creates an instance of SpeakerRecognitionCancellationDetails object for the canceled SpeakerRecognitionResult
     * @member SpeakerRecognitionCancellationDetails.fromResult
     * @function
     * @public
     * @param {SpeakerRecognitionResult} result - The result that was canceled.
     * @returns {SpeakerRecognitionCancellationDetails} The cancellation details object being created.
     */
    static fromResult(result) {
        const reason = Exports_js_2.CancellationReason.Error;
        let errorCode = Exports_js_2.CancellationErrorCode.NoError;
        if (!!result.properties) {
            errorCode = Exports_js_2.CancellationErrorCode[result.properties.getProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.NoError])];
        }
        return new SpeakerRecognitionCancellationDetails(reason, result.errorDetails, errorCode);
    }
}
exports.SpeakerRecognitionCancellationDetails = SpeakerRecognitionCancellationDetails;

//# sourceMappingURL=SpeakerRecognitionResult.js.map
