"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisVoicesResult = void 0;
const Exports_js_1 = require("./Exports.js");
/**
 * Defines result of speech synthesis.
 * @class SynthesisVoicesResult
 * Added in version 1.20.0
 */
class SynthesisVoicesResult extends Exports_js_1.SynthesisResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param requestId - result id for request.
     * @param json - json payload from endpoint.
     */
    constructor(requestId, json, errorDetails) {
        if (Array.isArray(json)) {
            super(requestId, Exports_js_1.ResultReason.VoicesListRetrieved, undefined, new Exports_js_1.PropertyCollection());
            this.privVoices = [];
            for (const item of json) {
                this.privVoices.push(new Exports_js_1.VoiceInfo(item));
            }
        }
        else {
            super(requestId, Exports_js_1.ResultReason.Canceled, errorDetails ? errorDetails : "Error information unavailable", new Exports_js_1.PropertyCollection());
        }
    }
    /**
     * The list of voices
     * @member SynthesisVoicesResult.prototype.voices
     * @function
     * @public
     * @returns {VoiceInfo[]} List of synthesized voices.
     */
    get voices() {
        return this.privVoices;
    }
}
exports.SynthesisVoicesResult = SynthesisVoicesResult;

//# sourceMappingURL=SynthesisVoicesResult.js.map
