// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Schemas extends APIResource {
    /**
     * Retrieve operations and features as OpenAPI schemas
     *
     * @example
     * ```ts
     * const schemas = await client.apiGateway.schemas.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/schemas`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=schemas.mjs.map