// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as OperationsAPI from "./operations.mjs";
import { Operations, } from "./operations.mjs";
import { V4PagePaginationArray } from "../../../pagination.mjs";
export class Discovery extends APIResource {
    constructor() {
        super(...arguments);
        this.operations = new OperationsAPI.Operations(this._client);
    }
    /**
     * Retrieve the most up to date view of discovered operations, rendered as OpenAPI
     * schemas
     *
     * @example
     * ```ts
     * const discovery = await client.apiGateway.discovery.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/api_gateway/discovery`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DiscoveryOperationsV4PagePaginationArray extends V4PagePaginationArray {
}
Discovery.Operations = Operations;
//# sourceMappingURL=discovery.mjs.map