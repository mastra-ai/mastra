// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class ServiceBindings extends APIResource {
    /**
     * Creates a new Service Binding, routing traffic to IPs within the given CIDR to a
     * service running on Cloudflare's network. **Note:** This API may only be used on
     * prefixes currently configured with a Magic Transit/Cloudflare CDN/Cloudflare
     * Spectrum service binding, and only allows creating upgrade service bindings for
     * the Cloudflare CDN or Cloudflare Spectrum.
     *
     * @example
     * ```ts
     * const serviceBinding =
     *   await client.addressing.prefixes.serviceBindings.create(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    create(prefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bindings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List the Cloudflare services this prefix is currently bound to. Traffic sent to
     * an address within an IP prefix will be routed to the Cloudflare service of the
     * most-specific Service Binding matching the address. **Example:** binding
     * `192.0.2.0/24` to Cloudflare Magic Transit and `192.0.2.1/32` to the Cloudflare
     * CDN would route traffic for `192.0.2.1` to the CDN, and traffic for all other
     * IPs in the prefix to Cloudflare Magic Transit.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const serviceBinding of client.addressing.prefixes.serviceBindings.list(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(prefixId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bindings`, ServiceBindingsSinglePage, options);
    }
    /**
     * Delete a Service Binding
     *
     * @example
     * ```ts
     * const serviceBinding =
     *   await client.addressing.prefixes.serviceBindings.delete(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '0429b49b6a5155297b78e75a44b09e14',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    delete(prefixId, bindingId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bindings/${bindingId}`, options);
    }
    /**
     * Fetch a single Service Binding
     *
     * @example
     * ```ts
     * const serviceBinding =
     *   await client.addressing.prefixes.serviceBindings.get(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '0429b49b6a5155297b78e75a44b09e14',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    get(prefixId, bindingId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bindings/${bindingId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ServiceBindingsSinglePage extends SinglePage {
}
ServiceBindings.ServiceBindingsSinglePage = ServiceBindingsSinglePage;
//# sourceMappingURL=service-bindings.mjs.map