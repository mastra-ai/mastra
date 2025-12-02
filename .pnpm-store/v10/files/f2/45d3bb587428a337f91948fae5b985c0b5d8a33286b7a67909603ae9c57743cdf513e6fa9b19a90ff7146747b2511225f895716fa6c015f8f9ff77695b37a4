"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CancellationDetails = void 0;
const Exports_js_1 = require("../common.speech/Exports.js");
const CancellationDetailsBase_js_1 = require("./CancellationDetailsBase.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Contains detailed information about why a result was canceled.
 * @class CancellationDetails
 */
class CancellationDetails extends CancellationDetailsBase_js_1.CancellationDetailsBase {
    constructor(reason, errorDetails, errorCode) {
        super(reason, errorDetails, errorCode);
    }
    /**
     * Creates an instance of CancellationDetails object for the canceled RecognitionResult.
     * @member CancellationDetails.fromResult
     * @function
     * @public
     * @param {RecognitionResult | SpeechSynthesisResult} result - The result that was canceled.
     * @returns {CancellationDetails} The cancellation details object being created.
     */
    static fromResult(result) {
        let reason = Exports_js_2.CancellationReason.Error;
        let errorCode = Exports_js_2.CancellationErrorCode.NoError;
        if (result instanceof Exports_js_2.RecognitionResult && !!result.json) {
            const simpleSpeech = Exports_js_1.SimpleSpeechPhrase.fromJSON(result.json, 0); // Offset fixups are already done.
            reason = Exports_js_1.EnumTranslation.implTranslateCancelResult(simpleSpeech.RecognitionStatus);
        }
        if (!!result.properties) {
            errorCode = Exports_js_2.CancellationErrorCode[result.properties.getProperty(Exports_js_1.CancellationErrorCodePropertyName, Exports_js_2.CancellationErrorCode[Exports_js_2.CancellationErrorCode.NoError])];
        }
        return new CancellationDetails(reason, result.errorDetails || Exports_js_1.EnumTranslation.implTranslateErrorDetails(errorCode), errorCode);
    }
}
exports.CancellationDetails = CancellationDetails;

//# sourceMappingURL=CancellationDetails.js.map
