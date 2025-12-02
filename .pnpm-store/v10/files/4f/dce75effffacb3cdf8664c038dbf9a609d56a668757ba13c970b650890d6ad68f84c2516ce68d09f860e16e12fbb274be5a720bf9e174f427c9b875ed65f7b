"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatasetsSinglePage = exports.Datasets = void 0;
const resource_1 = require("../../../../resource.js");
const UploadAPI = __importStar(require("./upload.js"));
const upload_1 = require("./upload.js");
const VersionsAPI = __importStar(require("./versions/versions.js"));
const versions_1 = require("./versions/versions.js");
const pagination_1 = require("../../../../pagination.js");
class Datasets extends resource_1.APIResource {
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
exports.Datasets = Datasets;
class DatasetsSinglePage extends pagination_1.SinglePage {
}
exports.DatasetsSinglePage = DatasetsSinglePage;
Datasets.DatasetsSinglePage = DatasetsSinglePage;
Datasets.Upload = upload_1.Upload;
Datasets.Versions = versions_1.Versions;
Datasets.VersionCreateResponsesSinglePage = versions_1.VersionCreateResponsesSinglePage;
//# sourceMappingURL=datasets.js.map