// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as OperationsAPI from "./operations.mjs";
import { OperationListResponsesV4PagePaginationArray, Operations, } from "./operations.mjs";
export class Settings extends APIResource {
    constructor() {
        super(...arguments);
        this.operations = new OperationsAPI.Operations(this._client);
    }
    /**
     * Update global schema validation settings
     *
     * @example
     * ```ts
     * const setting =
     *   await client.schemaValidation.settings.update({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     validation_default_mitigation_action: 'block',
     *   });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/schema_validation/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edit global schema validation settings
     *
     * @example
     * ```ts
     * const response =
     *   await client.schemaValidation.settings.edit({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/schema_validation/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get global schema validation settings
     *
     * @example
     * ```ts
     * const setting = await client.schemaValidation.settings.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/schema_validation/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
Settings.Operations = Operations;
Settings.OperationListResponsesV4PagePaginationArray = OperationListResponsesV4PagePaginationArray;
//# sourceMappingURL=settings.mjs.map