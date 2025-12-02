// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Networks extends APIResource {
    /**
     * Creates a new device managed network.
     *
     * @example
     * ```ts
     * const deviceNetwork =
     *   await client.zeroTrust.devices.networks.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     config: { tls_sockaddr: 'foo.bar:1234' },
     *     name: 'managed-network-1',
     *     type: 'tls',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/networks`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured device managed network.
     *
     * @example
     * ```ts
     * const deviceNetwork =
     *   await client.zeroTrust.devices.networks.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    update(networkId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/devices/networks/${networkId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a list of managed networks for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deviceNetwork of client.zeroTrust.devices.networks.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/networks`, DeviceNetworksSinglePage, options);
    }
    /**
     * Deletes a device managed network and fetches a list of the remaining device
     * managed networks for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const deviceNetwork of client.zeroTrust.devices.networks.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(networkId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/networks/${networkId}`, DeviceNetworksSinglePage, { method: 'delete', ...options });
    }
    /**
     * Fetches details for a single managed network.
     *
     * @example
     * ```ts
     * const deviceNetwork =
     *   await client.zeroTrust.devices.networks.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(networkId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/networks/${networkId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DeviceNetworksSinglePage extends SinglePage {
}
Networks.DeviceNetworksSinglePage = DeviceNetworksSinglePage;
//# sourceMappingURL=networks.mjs.map