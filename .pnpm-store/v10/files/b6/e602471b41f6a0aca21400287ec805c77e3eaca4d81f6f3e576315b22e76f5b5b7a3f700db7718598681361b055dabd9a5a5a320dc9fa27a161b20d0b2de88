"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoMatchDetails = void 0;
const Exports_js_1 = require("../../src/common.speech/Exports.js");
const Exports_js_2 = require("./Exports.js");
/**
 * Contains detailed information for NoMatch recognition results.
 * @class NoMatchDetails
 */
class NoMatchDetails {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {NoMatchReason} reason - The no-match reason.
     */
    constructor(reason) {
        this.privReason = reason;
    }
    /**
     * Creates an instance of NoMatchDetails object for the NoMatch SpeechRecognitionResults.
     * @member NoMatchDetails.fromResult
     * @function
     * @public
     * @param {SpeechRecognitionResult | IntentRecognitionResult | TranslationRecognitionResult}
     * result - The recognition result that was not recognized.
     * @returns {NoMatchDetails} The no match details object being created.
     */
    static fromResult(result) {
        const simpleSpeech = Exports_js_1.SimpleSpeechPhrase.fromJSON(result.json, 0); // Offset fixups are already done.
        let reason = Exports_js_2.NoMatchReason.NotRecognized;
        switch (simpleSpeech.RecognitionStatus) {
            case Exports_js_1.RecognitionStatus.BabbleTimeout:
                reason = Exports_js_2.NoMatchReason.InitialBabbleTimeout;
                break;
            case Exports_js_1.RecognitionStatus.InitialSilenceTimeout:
                reason = Exports_js_2.NoMatchReason.InitialSilenceTimeout;
                break;
            default:
                reason = Exports_js_2.NoMatchReason.NotRecognized;
                break;
        }
        return new NoMatchDetails(reason);
    }
    /**
     * The reason the recognition was canceled.
     * @member NoMatchDetails.prototype.reason
     * @function
     * @public
     * @returns {NoMatchReason} Specifies the reason canceled.
     */
    get reason() {
        return this.privReason;
    }
}
exports.NoMatchDetails = NoMatchDetails;

//# sourceMappingURL=NoMatchDetails.js.map
