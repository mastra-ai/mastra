// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as Core from "../../core.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Watermarks extends APIResource {
    /**
     * Creates watermark profiles using a single `HTTP POST multipart/form-data`
     * request.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   file: '@/Users/rchen/Downloads/watermark.png',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/watermarks`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all watermark profiles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const watermark of client.stream.watermarks.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/watermarks`, WatermarksSinglePage, options);
    }
    /**
     * Deletes a watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/watermarks/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves details for a single watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/watermarks/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class WatermarksSinglePage extends SinglePage {
}
Watermarks.WatermarksSinglePage = WatermarksSinglePage;
//# sourceMappingURL=watermarks.mjs.map