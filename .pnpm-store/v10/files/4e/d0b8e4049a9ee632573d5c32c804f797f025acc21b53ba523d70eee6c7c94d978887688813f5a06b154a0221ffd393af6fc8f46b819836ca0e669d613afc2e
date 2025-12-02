// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Upload extends APIResource {
    /**
     * Prepare to upload a new version of a dataset
     *
     * @example
     * ```ts
     * const newVersion =
     *   await client.zeroTrust.dlp.datasets.upload.create(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    create(datasetId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/dlp/datasets/${datasetId}/upload`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * This is used for single-column EDMv1 and Custom Word Lists. The EDM format can
     * only be created in the Cloudflare dashboard. For other clients, this operation
     * can only be used for non-secret Custom Word Lists. The body must be a UTF-8
     * encoded, newline (NL or CRNL) separated list of words to be matched.
     *
     * @example
     * ```ts
     * const dataset =
     *   await client.zeroTrust.dlp.datasets.upload.edit(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     0,
     *     {
     *       account_id: 'account_id',
     *       body: fs.createReadStream('path/to/file'),
     *     },
     *   );
     * ```
     */
    edit(datasetId, version, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/datasets/${datasetId}/upload/${version}`, {
            body: body,
            ...options,
            headers: { 'Content-Type': 'application/octet-stream', ...options?.headers },
            __binaryRequest: true,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=upload.mjs.map