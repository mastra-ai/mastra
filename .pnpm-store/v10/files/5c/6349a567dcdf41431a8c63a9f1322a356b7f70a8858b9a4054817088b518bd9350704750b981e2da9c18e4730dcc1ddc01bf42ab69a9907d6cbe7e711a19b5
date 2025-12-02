"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Datasets = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
class Datasets extends resource_1.APIResource {
    list(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.list({}, query);
        }
        return this._client.get('/radar/datasets', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves an URL to download a single dataset.
     *
     * @example
     * ```ts
     * const response = await client.radar.datasets.download({
     *   datasetId: 3,
     * });
     * ```
     */
    download(params, options) {
        const { format, ...body } = params;
        return this._client.post('/radar/datasets/download', {
            query: { format },
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves the CSV content of a given dataset by alias or ID. When getting the
     * content by alias the latest dataset is returned, optionally filtered by the
     * latest available at a given date.
     *
     * @example
     * ```ts
     * const dataset = await client.radar.datasets.get(
     *   'ranking_top_1000',
     * );
     * ```
     */
    get(alias, options) {
        return this._client.get(`/radar/datasets/${alias}`, {
            ...options,
            headers: { Accept: 'text/csv', ...options?.headers },
        });
    }
}
exports.Datasets = Datasets;
//# sourceMappingURL=datasets.js.map