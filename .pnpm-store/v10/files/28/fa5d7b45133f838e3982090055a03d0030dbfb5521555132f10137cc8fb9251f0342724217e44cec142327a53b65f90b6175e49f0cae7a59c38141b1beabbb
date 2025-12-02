"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationsSinglePage = exports.Integrations = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Integrations extends resource_1.APIResource {
    /**
     * Create a new device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.create(
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       config: {
     *         api_url: 'https://as123.awmdm.com/API',
     *         auth_url:
     *           'https://na.uemauth.vmwservices.com/connect/token',
     *         client_id: 'example client id',
     *         client_secret: 'example client secret',
     *       },
     *       interval: '10m',
     *       name: 'My Workspace One Integration',
     *       type: 'workspace_one',
     *     },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/posture/integration`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the list of device posture integrations for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const integration of client.zeroTrust.devices.posture.integrations.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/posture/integration`, IntegrationsSinglePage, options);
    }
    /**
     * Delete a configured device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    delete(integrationId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/posture/integration/${integrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(integrationId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/posture/integration/${integrationId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches details for a single device posture integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.devices.posture.integrations.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(integrationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/posture/integration/${integrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Integrations = Integrations;
class IntegrationsSinglePage extends pagination_1.SinglePage {
}
exports.IntegrationsSinglePage = IntegrationsSinglePage;
Integrations.IntegrationsSinglePage = IntegrationsSinglePage;
//# sourceMappingURL=integrations.js.map