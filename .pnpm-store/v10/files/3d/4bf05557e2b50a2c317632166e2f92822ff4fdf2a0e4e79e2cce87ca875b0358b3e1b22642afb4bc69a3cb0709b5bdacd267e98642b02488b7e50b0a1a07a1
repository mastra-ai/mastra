// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Copy extends APIResource {
    /**
     * Uploads a video to Stream from a provided URL.
     *
     * @example
     * ```ts
     * const video = await client.stream.copy.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   url: 'https://example.com/myvideo.mp4',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, 'Upload-Creator': uploadCreator, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/copy`, {
            body,
            ...options,
            headers: {
                ...(uploadCreator != null ? { 'Upload-Creator': uploadCreator } : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=copy.mjs.map