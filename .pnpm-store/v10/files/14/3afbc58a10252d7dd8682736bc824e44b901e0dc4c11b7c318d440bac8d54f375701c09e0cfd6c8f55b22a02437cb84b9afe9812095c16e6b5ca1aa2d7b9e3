// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
export class Fields extends APIResource {
    /**
     * Lists all fields available. The response is json object with key-value pairs,
     * where keys are field names, and values are descriptions.
     *
     * @example
     * ```ts
     * const field = await client.logs.received.fields.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/logs/received/fields`, options);
    }
}
//# sourceMappingURL=fields.mjs.map