// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class WorkflowResource extends APIResource {
    /**
     * Gets Zaraz workflow for a zone.
     *
     * @example
     * ```ts
     * const workflow = await client.zaraz.workflow.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/settings/zaraz/workflow`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=workflow.mjs.map