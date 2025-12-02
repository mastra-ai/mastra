// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AdvertisementStatusAPI from "./advertisement-status.mjs";
import { AdvertisementStatus, } from "./advertisement-status.mjs";
import * as BGPPrefixesAPI from "./bgp-prefixes.mjs";
import { BGPPrefixes, BGPPrefixesSinglePage, } from "./bgp-prefixes.mjs";
import * as DelegationsAPI from "./delegations.mjs";
import { DelegationsSinglePage, } from "./delegations.mjs";
import * as ServiceBindingsAPI from "./service-bindings.mjs";
import { ServiceBindings, ServiceBindingsSinglePage, } from "./service-bindings.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Prefixes extends APIResource {
    constructor() {
        super(...arguments);
        this.serviceBindings = new ServiceBindingsAPI.ServiceBindings(this._client);
        this.bgpPrefixes = new BGPPrefixesAPI.BGPPrefixes(this._client);
        this.advertisementStatus = new AdvertisementStatusAPI.AdvertisementStatus(this._client);
        this.delegations = new DelegationsAPI.Delegations(this._client);
    }
    /**
     * Add a new prefix under the account.
     *
     * @example
     * ```ts
     * const prefix = await client.addressing.prefixes.create({
     *   account_id: '258def64c72dae45f3e4c8516e2111f2',
     *   asn: 209242,
     *   cidr: '192.0.2.0/24',
     *   loa_document_id: 'd933b1530bc56c9953cf8ce166da8004',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/prefixes`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all prefixes owned by the account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const prefix of client.addressing.prefixes.list({
     *   account_id: '258def64c72dae45f3e4c8516e2111f2',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/addressing/prefixes`, PrefixesSinglePage, options);
    }
    /**
     * Delete an unapproved prefix owned by the account.
     *
     * @example
     * ```ts
     * const prefix = await client.addressing.prefixes.delete(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * );
     * ```
     */
    delete(prefixId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/addressing/prefixes/${prefixId}`, options);
    }
    /**
     * Modify the description for a prefix owned by the account.
     *
     * @example
     * ```ts
     * const prefix = await client.addressing.prefixes.edit(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   {
     *     account_id: '258def64c72dae45f3e4c8516e2111f2',
     *     description: 'Internal test prefix',
     *   },
     * );
     * ```
     */
    edit(prefixId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/addressing/prefixes/${prefixId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List a particular prefix owned by the account.
     *
     * @example
     * ```ts
     * const prefix = await client.addressing.prefixes.get(
     *   '2af39739cc4e3b5910c918468bb89828',
     *   { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     * );
     * ```
     */
    get(prefixId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/prefixes/${prefixId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class PrefixesSinglePage extends SinglePage {
}
Prefixes.PrefixesSinglePage = PrefixesSinglePage;
Prefixes.ServiceBindings = ServiceBindings;
Prefixes.ServiceBindingsSinglePage = ServiceBindingsSinglePage;
Prefixes.BGPPrefixes = BGPPrefixes;
Prefixes.BGPPrefixesSinglePage = BGPPrefixesSinglePage;
Prefixes.AdvertisementStatus = AdvertisementStatus;
Prefixes.DelegationsSinglePage = DelegationsSinglePage;
//# sourceMappingURL=prefixes.mjs.map