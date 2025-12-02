// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Tags extends APIResource {
    /**
     * Create a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/access/tags`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.update(
     *   'engineers',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     name: 'engineers',
     *   },
     * );
     * ```
     */
    update(tagName, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/access/tags/${tagName}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List tags
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tag of client.zeroTrust.access.tags.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/tags`, TagsSinglePage, options);
    }
    /**
     * Delete a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.delete(
     *   'engineers',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(tagName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/access/tags/${tagName}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a tag
     *
     * @example
     * ```ts
     * const tag = await client.zeroTrust.access.tags.get(
     *   'engineers',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(tagName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/tags/${tagName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class TagsSinglePage extends SinglePage {
}
Tags.TagsSinglePage = TagsSinglePage;
//# sourceMappingURL=tags.mjs.map