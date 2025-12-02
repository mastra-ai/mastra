"use strict";
// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SynthesisResult = void 0;
/**
 * Base class for synthesis results
 * @class SynthesisResult
 * Added in version 1.20.0
 */
class SynthesisResult {
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} resultId - The result id.
     * @param {ResultReason} reason - The reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {PropertyCollection} properties - Additional properties, if provided.
     */
    constructor(resultId, reason, errorDetails, properties) {
        this.privResultId = resultId;
        this.privReason = reason;
        this.privErrorDetails = errorDetails;
        this.privProperties = properties;
    }
    /**
     * Specifies the result identifier.
     * @member SynthesisResult.prototype.resultId
     * @function
     * @public
     * @returns {string} Specifies the result identifier.
     */
    get resultId() {
        return this.privResultId;
    }
    /**
     * Specifies status of the result.
     * @member SynthesisResult.prototype.reason
     * @function
     * @public
     * @returns {ResultReason} Specifies status of the result.
     */
    get reason() {
        return this.privReason;
    }
    /**
     * In case of an unsuccessful synthesis, provides details of the occurred error.
     * @member SynthesisResult.prototype.errorDetails
     * @function
     * @public
     * @returns {string} a brief description of an error.
     */
    get errorDetails() {
        return this.privErrorDetails;
    }
    /**
     * The set of properties exposed in the result.
     * @member SynthesisResult.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The set of properties exposed in the result.
     */
    get properties() {
        return this.privProperties;
    }
}
exports.SynthesisResult = SynthesisResult;

//# sourceMappingURL=SynthesisResult.js.map
