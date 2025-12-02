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
exports.InvestigateListResponsesV4PagePaginationArray = exports.Investigate = void 0;
const resource_1 = require("../../../resource.js");
const DetectionsAPI = __importStar(require("./detections.js"));
const detections_1 = require("./detections.js");
const MoveAPI = __importStar(require("./move.js"));
const move_1 = require("./move.js");
const PreviewAPI = __importStar(require("./preview.js"));
const preview_1 = require("./preview.js");
const RawAPI = __importStar(require("./raw.js"));
const raw_1 = require("./raw.js");
const ReclassifyAPI = __importStar(require("./reclassify.js"));
const reclassify_1 = require("./reclassify.js");
const ReleaseAPI = __importStar(require("./release.js"));
const release_1 = require("./release.js");
const TraceAPI = __importStar(require("./trace.js"));
const trace_1 = require("./trace.js");
const pagination_1 = require("../../../pagination.js");
class Investigate extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.detections = new DetectionsAPI.Detections(this._client);
        this.preview = new PreviewAPI.Preview(this._client);
        this.raw = new RawAPI.Raw(this._client);
        this.trace = new TraceAPI.Trace(this._client);
        this.move = new MoveAPI.Move(this._client);
        this.reclassify = new ReclassifyAPI.Reclassify(this._client);
        this.release = new ReleaseAPI.Release(this._client);
    }
    /**
     * Returns information for each email that matches the search parameter(s).
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const investigateListResponse of client.emailSecurity.investigate.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/email-security/investigate`, InvestigateListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Get message details
     *
     * @example
     * ```ts
     * const investigate =
     *   await client.emailSecurity.investigate.get(
     *     '4Njp3P0STMz2c02Q',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(postfixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/email-security/investigate/${postfixId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Investigate = Investigate;
class InvestigateListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.InvestigateListResponsesV4PagePaginationArray = InvestigateListResponsesV4PagePaginationArray;
Investigate.InvestigateListResponsesV4PagePaginationArray = InvestigateListResponsesV4PagePaginationArray;
Investigate.Detections = detections_1.Detections;
Investigate.Preview = preview_1.Preview;
Investigate.Raw = raw_1.Raw;
Investigate.Trace = trace_1.Trace;
Investigate.Move = move_1.Move;
Investigate.MoveCreateResponsesSinglePage = move_1.MoveCreateResponsesSinglePage;
Investigate.MoveBulkResponsesSinglePage = move_1.MoveBulkResponsesSinglePage;
Investigate.Reclassify = reclassify_1.Reclassify;
Investigate.Release = release_1.Release;
Investigate.ReleaseBulkResponsesSinglePage = release_1.ReleaseBulkResponsesSinglePage;
//# sourceMappingURL=investigate.js.map