// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as EntriesAPI from "./entries.mjs";
import { Entries } from "./entries.mjs";
import { SinglePage } from "../../../../../pagination.mjs";
export class Versions extends APIResource {
    constructor() {
        super(...arguments);
        this.entries = new EntriesAPI.Entries(this._client);
    }
    /**
     * This is used for multi-column EDMv2 datasets. The EDMv2 format can only be
     * created in the Cloudflare dashboard. The columns in the response appear in the
     * same order as in the request.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const versionCreateResponse of client.zeroTrust.dlp.datasets.versions.create(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   0,
     *   {
     *     account_id: 'account_id',
     *     body: [
     *       { entry_id: '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e' },
     *     ],
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    create(datasetId, version, params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/datasets/${datasetId}/versions/${version}`, VersionCreateResponsesSinglePage, { body: body, method: 'post', ...options });
    }
}
export class VersionCreateResponsesSinglePage extends SinglePage {
}
Versions.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;
Versions.Entries = Entries;
//# sourceMappingURL=versions.mjs.map