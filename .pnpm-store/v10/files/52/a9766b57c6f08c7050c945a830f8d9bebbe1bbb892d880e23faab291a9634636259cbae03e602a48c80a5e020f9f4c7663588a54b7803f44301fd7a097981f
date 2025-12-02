// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class DirectUpload extends APIResource {
    /**
     * Creates a direct upload that allows video uploads without an API key.
     *
     * @example
     * ```ts
     * const directUpload =
     *   await client.stream.directUpload.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     maxDurationSeconds: 1,
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, 'Upload-Creator': uploadCreator, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/direct_upload`, {
            body,
            ...options,
            headers: {
                ...(uploadCreator != null ? { 'Upload-Creator': uploadCreator } : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=direct-upload.mjs.map