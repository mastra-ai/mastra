import { PropertyCollection, ResultReason } from "./Exports.js";
/**
 * Base class for synthesis results
 * @class SynthesisResult
 * Added in version 1.20.0
 */
export declare class SynthesisResult {
    private privResultId;
    private privReason;
    private privErrorDetails;
    private privProperties;
    /**
     * Creates and initializes an instance of this class.
     * @constructor
     * @param {string} resultId - The result id.
     * @param {ResultReason} reason - The reason.
     * @param {string} errorDetails - Error details, if provided.
     * @param {PropertyCollection} properties - Additional properties, if provided.
     */
    constructor(resultId?: string, reason?: ResultReason, errorDetails?: string, properties?: PropertyCollection);
    /**
     * Specifies the result identifier.
     * @member SynthesisResult.prototype.resultId
     * @function
     * @public
     * @returns {string} Specifies the result identifier.
     */
    get resultId(): string;
    /**
     * Specifies status of the result.
     * @member SynthesisResult.prototype.reason
     * @function
     * @public
     * @returns {ResultReason} Specifies status of the result.
     */
    get reason(): ResultReason;
    /**
     * In case of an unsuccessful synthesis, provides details of the occurred error.
     * @member SynthesisResult.prototype.errorDetails
     * @function
     * @public
     * @returns {string} a brief description of an error.
     */
    get errorDetails(): string;
    /**
     * The set of properties exposed in the result.
     * @member SynthesisResult.prototype.properties
     * @function
     * @public
     * @returns {PropertyCollection} The set of properties exposed in the result.
     */
    get properties(): PropertyCollection;
}
