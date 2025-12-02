// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class URLs extends APIResource {
    /**
     * Get Gateway URL
     *
     * @example
     * ```ts
     * const url = await client.aiGateway.urls.get(
     *   'my-gateway',
     *   'workers-ai',
     *   { account_id: '0d37909e38d3e99c29fa2cd343ac421a' },
     * );
     * ```
     */
    get(gatewayId, provider, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai-gateway/gateways/${gatewayId}/url/${provider}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=urls.mjs.map