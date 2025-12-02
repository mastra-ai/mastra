"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.URLs = void 0;
const resource_1 = require("../../resource.js");
class URLs extends resource_1.APIResource {
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
exports.URLs = URLs;
//# sourceMappingURL=urls.js.map