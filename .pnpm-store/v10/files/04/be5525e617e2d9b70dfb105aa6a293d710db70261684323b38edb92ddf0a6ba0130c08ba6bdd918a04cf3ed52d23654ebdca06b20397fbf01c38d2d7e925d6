// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
import { V4PagePagination } from "../../../pagination.mjs";
export class Versions extends APIResource {
    /**
     * Upload a Worker Version without deploying to Cloudflare's network. You can find
     * more about the multipart metadata on our docs:
     * https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/.
     *
     * @example
     * ```ts
     * const version =
     *   await client.workers.scripts.versions.create(
     *     'this-is_my_script-01',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       metadata: { main_module: 'worker.js' },
     *     },
     *   );
     * ```
     */
    create(scriptName, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/scripts/${scriptName}/versions`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * List of Worker Versions. The first version in the list is the latest version.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const versionListResponse of client.workers.scripts.versions.list(
     *   'this-is_my_script-01',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(scriptName, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/scripts/${scriptName}/versions`, VersionListResponsesV4PagePagination, { query, ...options });
    }
    /**
     * Get Version Detail
     *
     * @example
     * ```ts
     * const version = await client.workers.scripts.versions.get(
     *   'this-is_my_script-01',
     *   'bcf48806-b317-4351-9ee7-36e7d557d4de',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(scriptName, versionId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/scripts/${scriptName}/versions/${versionId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class VersionListResponsesV4PagePagination extends V4PagePagination {
}
Versions.VersionListResponsesV4PagePagination = VersionListResponsesV4PagePagination;
//# sourceMappingURL=versions.mjs.map