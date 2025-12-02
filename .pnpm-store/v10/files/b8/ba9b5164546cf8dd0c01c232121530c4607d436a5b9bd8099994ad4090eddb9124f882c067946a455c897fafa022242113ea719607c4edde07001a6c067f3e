"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Entries = void 0;
const resource_1 = require("../../../../../resource.js");
class Entries extends resource_1.APIResource {
    /**
     * This is used for multi-column EDMv2 datasets. The EDMv2 format can only be
     * created in the Cloudflare dashboard.
     *
     * @example
     * ```ts
     * const entry =
     *   await client.zeroTrust.dlp.datasets.versions.entries.create(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     0,
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: 'account_id',
     *       body: fs.createReadStream('path/to/file'),
     *     },
     *   );
     * ```
     */
    create(datasetId, version, entryId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/datasets/${datasetId}/versions/${version}/entries/${entryId}`, {
            body: body,
            ...options,
            headers: { 'Content-Type': 'application/octet-stream', ...options?.headers },
            __binaryRequest: true,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Entries = Entries;
//# sourceMappingURL=entries.js.map