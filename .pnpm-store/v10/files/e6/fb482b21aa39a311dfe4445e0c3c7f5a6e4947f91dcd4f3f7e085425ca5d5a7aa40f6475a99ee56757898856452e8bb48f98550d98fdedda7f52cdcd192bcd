"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowResource = void 0;
const resource_1 = require("../../resource.js");
class WorkflowResource extends resource_1.APIResource {
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
exports.WorkflowResource = WorkflowResource;
//# sourceMappingURL=workflow.js.map