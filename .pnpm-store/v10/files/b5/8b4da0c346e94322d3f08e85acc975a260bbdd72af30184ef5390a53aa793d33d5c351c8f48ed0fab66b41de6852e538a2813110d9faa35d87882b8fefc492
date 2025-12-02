// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as DetectionsAPI from "./detections.mjs";
import { DetectionListResponsesSinglePage, Detections, } from "./detections.mjs";
export class LeakedCredentialChecks extends APIResource {
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
LeakedCredentialChecks.Detections = Detections;
LeakedCredentialChecks.DetectionListResponsesSinglePage = DetectionListResponsesSinglePage;
//# sourceMappingURL=leaked-credential-checks.mjs.map