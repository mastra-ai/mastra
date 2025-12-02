"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretListResponsesSinglePage = exports.Secrets = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Secrets extends resource_1.APIResource {
    /**
     * Add a secret to a script.
     *
     * @example
     * ```ts
     * const secret = await client.workers.scripts.secrets.update(
     *   'this-is_my_script-01',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'myBinding',
     *     text: 'My secret.',
     *     type: 'secret_text',
     *   },
     * );
     * ```
     */
    update(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/workers/scripts/${scriptName}/secrets`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List secrets bound to a script.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const secretListResponse of client.workers.scripts.secrets.list(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(scriptName, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/scripts/${scriptName}/secrets`, SecretListResponsesSinglePage, options);
    }
    /**
     * Remove a secret from a script.
     *
     * @example
     * ```ts
     * const secret = await client.workers.scripts.secrets.delete(
     *   'this-is_my_script-01',
     *   'mySecret',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(scriptName, secretName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/scripts/${scriptName}/secrets/${secretName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a given secret binding (value omitted) on a script.
     *
     * @example
     * ```ts
     * const secret = await client.workers.scripts.secrets.get(
     *   'this-is_my_script-01',
     *   'mySecret',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, secretName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/secrets/${secretName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Secrets = Secrets;
class SecretListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.SecretListResponsesSinglePage = SecretListResponsesSinglePage;
Secrets.SecretListResponsesSinglePage = SecretListResponsesSinglePage;
//# sourceMappingURL=secrets.js.map