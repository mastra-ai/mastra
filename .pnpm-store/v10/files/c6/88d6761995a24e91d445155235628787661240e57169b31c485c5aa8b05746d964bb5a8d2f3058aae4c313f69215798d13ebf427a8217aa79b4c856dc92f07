// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as UploadAPI from "./upload.mjs";
import { Upload as UploadAPIUpload } from "./upload.mjs";
import * as VersionsAPI from "./versions/versions.mjs";
import { VersionCreateResponsesSinglePage, Versions, } from "./versions/versions.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Datasets extends APIResource {
    constructor() {
        super(...arguments);
        this.upload = new UploadAPI.Upload(this._client);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Create a new dataset
     *
     * @example
     * ```ts
     * const datasetCreation =
     *   await client.zeroTrust.dlp.datasets.create({
     *     account_id: 'account_id',
     *     name: 'name',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/datasets`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update details about a dataset
     *
     * @example
     * ```ts
     * const dataset = await client.zeroTrust.dlp.datasets.update(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    update(datasetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/datasets/${datasetId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch all datasets
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const dataset of client.zeroTrust.dlp.datasets.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/datasets`, DatasetsSinglePage, options);
    }
    /**
     * This deletes all versions of the dataset.
     *
     * @example
     * ```ts
     * await client.zeroTrust.dlp.datasets.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(datasetId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/datasets/${datasetId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Fetch a specific dataset
     *
     * @example
     * ```ts
     * const dataset = await client.zeroTrust.dlp.datasets.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(datasetId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/datasets/${datasetId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class DatasetsSinglePage extends SinglePage {
}
Datasets.DatasetsSinglePage = DatasetsSinglePage;
Datasets.Upload = UploadAPIUpload;
Datasets.Versions = Versions;
Datasets.VersionCreateResponsesSinglePage = VersionCreateResponsesSinglePage;
//# sourceMappingURL=datasets.mjs.map