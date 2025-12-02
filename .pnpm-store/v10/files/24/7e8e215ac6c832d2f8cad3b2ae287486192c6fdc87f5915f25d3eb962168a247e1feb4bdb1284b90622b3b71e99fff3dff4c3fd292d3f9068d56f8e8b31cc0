// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Downloads extends APIResource {
    /**
     * Creates a download for a video when a video is ready to view.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.create(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     body: {},
     *   },
     * );
     * ```
     */
    create(identifier, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/stream/${identifier}/downloads`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete the downloads for a video.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/${identifier}/downloads`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists the downloads created for a video.
     *
     * @example
     * ```ts
     * const download = await client.stream.downloads.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/${identifier}/downloads`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=downloads.mjs.map