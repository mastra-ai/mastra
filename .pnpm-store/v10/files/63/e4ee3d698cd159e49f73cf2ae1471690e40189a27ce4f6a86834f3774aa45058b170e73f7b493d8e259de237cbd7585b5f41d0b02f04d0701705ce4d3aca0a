// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Assets extends APIResource {
    /**
     * List Request Assets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const assetCreateResponse of client.cloudforceOne.requests.assets.create(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     page: 0,
     *     per_page: 10,
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(requestId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/asset`, AssetCreateResponsesSinglePage, { body, method: 'post', ...options });
    }
    /**
     * Update a Request Asset
     *
     * @example
     * ```ts
     * const asset =
     *   await client.cloudforceOne.requests.assets.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    update(requestId, assetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/asset/${assetId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete a Request Asset
     *
     * @example
     * ```ts
     * const asset =
     *   await client.cloudforceOne.requests.assets.delete(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(requestId, assetId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/asset/${assetId}`, options);
    }
    /**
     * Get a Request Asset
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const assetGetResponse of client.cloudforceOne.requests.assets.get(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(requestId, assetId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/cloudforce-one/requests/${requestId}/asset/${assetId}`, AssetGetResponsesSinglePage, options);
    }
}
export class AssetCreateResponsesSinglePage extends SinglePage {
}
export class AssetGetResponsesSinglePage extends SinglePage {
}
Assets.AssetCreateResponsesSinglePage = AssetCreateResponsesSinglePage;
Assets.AssetGetResponsesSinglePage = AssetGetResponsesSinglePage;
//# sourceMappingURL=assets.mjs.map