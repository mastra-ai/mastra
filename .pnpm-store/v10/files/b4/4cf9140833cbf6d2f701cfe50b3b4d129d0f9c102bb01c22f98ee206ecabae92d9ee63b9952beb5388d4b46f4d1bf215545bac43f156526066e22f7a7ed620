// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Detections extends APIResource {
    /**
     * Create user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/leaked-credential-checks/detections`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.update(
     *     '18a14bafaa8eb1df04ce683ec18c765e',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(detectionId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/leaked-credential-checks/detections/${detectionId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List user-defined detection patterns for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const detectionListResponse of client.leakedCredentialChecks.detections.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/leaked-credential-checks/detections`, DetectionListResponsesSinglePage, options);
    }
    /**
     * Remove user-defined detection pattern for Leaked Credential Checks.
     *
     * @example
     * ```ts
     * const detection =
     *   await client.leakedCredentialChecks.detections.delete(
     *     '18a14bafaa8eb1df04ce683ec18c765e',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(detectionId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/leaked-credential-checks/detections/${detectionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DetectionListResponsesSinglePage extends SinglePage {
}
Detections.DetectionListResponsesSinglePage = DetectionListResponsesSinglePage;
//# sourceMappingURL=detections.mjs.map