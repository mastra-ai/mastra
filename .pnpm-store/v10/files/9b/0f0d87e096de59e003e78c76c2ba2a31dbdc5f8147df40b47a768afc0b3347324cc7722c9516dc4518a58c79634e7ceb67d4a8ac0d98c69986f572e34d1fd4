"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VirtualNetworksSinglePage = exports.VirtualNetworks = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class VirtualNetworks extends resource_1.APIResource {
    /**
     * Adds a new virtual network to an account.
     *
     * @example
     * ```ts
     * const virtualNetwork =
     *   await client.zeroTrust.networks.virtualNetworks.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     name: 'us-east-1-vpc',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/teamnet/virtual_networks`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists and filters virtual networks in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const virtualNetwork of client.zeroTrust.networks.virtualNetworks.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/teamnet/virtual_networks`, VirtualNetworksSinglePage, { query, ...options });
    }
    /**
     * Deletes an existing virtual network.
     *
     * @example
     * ```ts
     * const virtualNetwork =
     *   await client.zeroTrust.networks.virtualNetworks.delete(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(virtualNetworkId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing virtual network.
     *
     * @example
     * ```ts
     * const virtualNetwork =
     *   await client.zeroTrust.networks.virtualNetworks.edit(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(virtualNetworkId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a virtual network.
     *
     * @example
     * ```ts
     * const virtualNetwork =
     *   await client.zeroTrust.networks.virtualNetworks.get(
     *     'f70ff985-a4ef-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(virtualNetworkId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/teamnet/virtual_networks/${virtualNetworkId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.VirtualNetworks = VirtualNetworks;
class VirtualNetworksSinglePage extends pagination_1.SinglePage {
}
exports.VirtualNetworksSinglePage = VirtualNetworksSinglePage;
VirtualNetworks.VirtualNetworksSinglePage = VirtualNetworksSinglePage;
//# sourceMappingURL=virtual-networks.js.map