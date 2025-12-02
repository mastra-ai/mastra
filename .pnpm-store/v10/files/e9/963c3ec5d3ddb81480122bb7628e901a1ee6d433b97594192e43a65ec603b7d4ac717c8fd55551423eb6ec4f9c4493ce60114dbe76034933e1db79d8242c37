// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class DEXTests extends APIResource {
    /**
     * Create a DEX test.
     *
     * @example
     * ```ts
     * const dexTest =
     *   await client.zeroTrust.devices.dexTests.create({
     *     account_id: '01a7362d577a6c3019a474fd6f485823',
     *     data: {},
     *     enabled: true,
     *     interval: '30m',
     *     name: 'HTTP dash health check',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dex/devices/dex_tests`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a DEX test.
     *
     * @example
     * ```ts
     * const dexTest =
     *   await client.zeroTrust.devices.dexTests.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '01a7362d577a6c3019a474fd6f485823',
     *       data: {},
     *       enabled: true,
     *       interval: '30m',
     *       name: 'HTTP dash health check',
     *     },
     *   );
     * ```
     */
    update(dexTestId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch all DEX tests
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dexTestListResponse of client.zeroTrust.devices.dexTests.list(
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/devices/dex_tests`, DEXTestListResponsesSinglePage, options);
    }
    /**
     * Delete a Device DEX test. Returns the remaining device dex tests for the
     * account.
     *
     * @example
     * ```ts
     * const dexTest =
     *   await client.zeroTrust.devices.dexTests.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '01a7362d577a6c3019a474fd6f485823' },
     *   );
     * ```
     */
    delete(dexTestId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a single DEX test.
     *
     * @example
     * ```ts
     * const dexTest = await client.zeroTrust.devices.dexTests.get(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { account_id: '01a7362d577a6c3019a474fd6f485823' },
     * );
     * ```
     */
    get(dexTestId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dex/devices/dex_tests/${dexTestId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DEXTestListResponsesSinglePage extends SinglePage {
}
DEXTests.DEXTestListResponsesSinglePage = DEXTestListResponsesSinglePage;
//# sourceMappingURL=dex-tests.mjs.map