// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as DetectionsAPI from "./detections.mjs";
import { Detections } from "./detections.mjs";
import * as MoveAPI from "./move.mjs";
import { Move, MoveBulkResponsesSinglePage, MoveCreateResponsesSinglePage, } from "./move.mjs";
import * as PreviewAPI from "./preview.mjs";
import { Preview, } from "./preview.mjs";
import * as RawAPI from "./raw.mjs";
import { Raw } from "./raw.mjs";
import * as ReclassifyAPI from "./reclassify.mjs";
import { Reclassify } from "./reclassify.mjs";
import * as ReleaseAPI from "./release.mjs";
import { Release, ReleaseBulkResponsesSinglePage } from "./release.mjs";
import * as TraceAPI from "./trace.mjs";
import { Trace } from "./trace.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Investigate extends APIResource {
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
export class InvestigateListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
Investigate.InvestigateListResponsesV4PagePaginationArray = InvestigateListResponsesV4PagePaginationArray;
Investigate.Detections = Detections;
Investigate.Preview = Preview;
Investigate.Raw = Raw;
Investigate.Trace = Trace;
Investigate.Move = Move;
Investigate.MoveCreateResponsesSinglePage = MoveCreateResponsesSinglePage;
Investigate.MoveBulkResponsesSinglePage = MoveBulkResponsesSinglePage;
Investigate.Reclassify = Reclassify;
Investigate.Release = Release;
Investigate.ReleaseBulkResponsesSinglePage = ReleaseBulkResponsesSinglePage;
//# sourceMappingURL=investigate.mjs.map