"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigListResponsesSinglePage = exports.Config = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Config extends resource_1.APIResource {
    /**
     * Create a new Scan Config
     *
     * @example
     * ```ts
     * const config =
     *   await client.cloudforceOne.scans.config.create({
     *     account_id: 'account_id',
     *     ips: ['1.1.1.1', '2606:4700:4700::1111'],
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/cloudforce-one/scans/config`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Scan Configs
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const configListResponse of client.cloudforceOne.scans.config.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/scans/config`, ConfigListResponsesSinglePage, options);
    }
    /**
     * Delete a Scan Config
     *
     * @example
     * ```ts
     * const config =
     *   await client.cloudforceOne.scans.config.delete(
     *     'config_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(configId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/scans/config/${configId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing Scan Config
     *
     * @example
     * ```ts
     * const response =
     *   await client.cloudforceOne.scans.config.edit(
     *     'config_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    edit(configId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/cloudforce-one/scans/config/${configId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Config = Config;
class ConfigListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ConfigListResponsesSinglePage = ConfigListResponsesSinglePage;
Config.ConfigListResponsesSinglePage = ConfigListResponsesSinglePage;
//# sourceMappingURL=config.js.map