// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class BGPPrefixes extends APIResource {
    /**
     * Create a BGP prefix, controlling the BGP advertisement status of a specific
     * subnet. When created, BGP prefixes are initially withdrawn, and can be
     * advertised with the Update BGP Prefix API.
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.create(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    create(prefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/prefixes`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all BGP Prefixes within the specified IP Prefix. BGP Prefixes are used to
     * control which specific subnets are advertised to the Internet. It is possible to
     * advertise subnets more specific than an IP Prefix by creating more specific BGP
     * Prefixes.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const bgpPrefix of client.addressing.prefixes.bgpPrefixes.list(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(prefixId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/prefixes`, BGPPrefixesSinglePage, options);
    }
    /**
     * Update the properties of a BGP Prefix, such as the on demand advertisement
     * status (advertised or withdrawn).
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.edit(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '7009ba364c7a5760798ceb430e603b74',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    edit(prefixId, bgpPrefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/prefixes/${bgpPrefixId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve a single BGP Prefix according to its identifier
     *
     * @example
     * ```ts
     * const bgpPrefix =
     *   await client.addressing.prefixes.bgpPrefixes.get(
     *     '2af39739cc4e3b5910c918468bb89828',
     *     '7009ba364c7a5760798ceb430e603b74',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     * ```
     */
    get(prefixId, bgpPrefixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/prefixes/${prefixId}/bgp/prefixes/${bgpPrefixId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class BGPPrefixesSinglePage extends SinglePage {
}
BGPPrefixes.BGPPrefixesSinglePage = BGPPrefixesSinglePage;
//# sourceMappingURL=bgp-prefixes.mjs.map