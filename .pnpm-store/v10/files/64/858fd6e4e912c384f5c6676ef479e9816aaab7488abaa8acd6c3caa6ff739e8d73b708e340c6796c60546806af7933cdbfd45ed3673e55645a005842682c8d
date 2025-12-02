"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeakedCredentialChecks = void 0;
const resource_1 = require("../../resource.js");
const DetectionsAPI = __importStar(require("./detections.js"));
const detections_1 = require("./detections.js");
class LeakedCredentialChecks extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.detections = new DetectionsAPI.Detections(this._client);
    }
    /**
     * Updates the current status of Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const leakedCredentialCheck =
     *   await client.leakedCredentialChecks.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/leaked-credential-checks`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves the current status of Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const leakedCredentialCheck =
     *   await client.leakedCredentialChecks.get({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/leaked-credential-checks`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.LeakedCredentialChecks = LeakedCredentialChecks;
LeakedCredentialChecks.Detections = detections_1.Detections;
LeakedCredentialChecks.DetectionListResponsesSinglePage = detections_1.DetectionListResponsesSinglePage;
//# sourceMappingURL=leaked-credential-checks.js.map