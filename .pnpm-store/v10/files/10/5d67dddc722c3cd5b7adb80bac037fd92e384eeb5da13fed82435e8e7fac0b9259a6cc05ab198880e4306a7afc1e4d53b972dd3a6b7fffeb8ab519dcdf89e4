"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrefixesSinglePage = exports.Prefixes = void 0;
const resource_1 = require("../../../resource.js");
const AdvertisementStatusAPI = __importStar(require("./advertisement-status.js"));
const advertisement_status_1 = require("./advertisement-status.js");
const BGPPrefixesAPI = __importStar(require("./bgp-prefixes.js"));
const bgp_prefixes_1 = require("./bgp-prefixes.js");
const DelegationsAPI = __importStar(require("./delegations.js"));
const delegations_1 = require("./delegations.js");
const ServiceBindingsAPI = __importStar(require("./service-bindings.js"));
const service_bindings_1 = require("./service-bindings.js");
const pagination_1 = require("../../../pagination.js");
class Prefixes extends resource_1.APIResource {
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
exports.Prefixes = Prefixes;
class PrefixesSinglePage extends pagination_1.SinglePage {
}
exports.PrefixesSinglePage = PrefixesSinglePage;
Prefixes.PrefixesSinglePage = PrefixesSinglePage;
Prefixes.ServiceBindings = service_bindings_1.ServiceBindings;
Prefixes.ServiceBindingsSinglePage = service_bindings_1.ServiceBindingsSinglePage;
Prefixes.BGPPrefixes = bgp_prefixes_1.BGPPrefixes;
Prefixes.BGPPrefixesSinglePage = bgp_prefixes_1.BGPPrefixesSinglePage;
Prefixes.AdvertisementStatus = advertisement_status_1.AdvertisementStatus;
Prefixes.DelegationsSinglePage = delegations_1.DelegationsSinglePage;
//# sourceMappingURL=prefixes.js.map