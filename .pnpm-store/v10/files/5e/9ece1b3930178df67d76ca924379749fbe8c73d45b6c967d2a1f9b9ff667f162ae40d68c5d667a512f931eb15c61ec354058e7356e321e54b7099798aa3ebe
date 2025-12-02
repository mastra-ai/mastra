// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class ProxyEndpoints extends APIResource {
    /**
     * Creates a new Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     ips: ['192.0.2.1/32'],
     *     name: 'Devops team',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/proxy_endpoints`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches all Zero Trust Gateway proxy endpoints for an account.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.list({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/proxy_endpoints`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a configured Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.delete(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(proxyEndpointId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/gateway/proxy_endpoints/${proxyEndpointId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * const proxyEndpoint =
     *   await client.zeroTrust.gateway.proxyEndpoints.edit(
     *     'ed35569b41ce4d1facfe683550f54086',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(proxyEndpointId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/gateway/proxy_endpoints/${proxyEndpointId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Zero Trust Gateway proxy endpoint.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const proxyEndpoint of client.zeroTrust.gateway.proxyEndpoints.get(
     *   'ed35569b41ce4d1facfe683550f54086',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(proxyEndpointId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/proxy_endpoints/${proxyEndpointId}`, ProxyEndpointsSinglePage, options);
    }
}
export class ProxyEndpointsSinglePage extends SinglePage {
}
ProxyEndpoints.ProxyEndpointsSinglePage = ProxyEndpointsSinglePage;
//# sourceMappingURL=proxy-endpoints.mjs.map