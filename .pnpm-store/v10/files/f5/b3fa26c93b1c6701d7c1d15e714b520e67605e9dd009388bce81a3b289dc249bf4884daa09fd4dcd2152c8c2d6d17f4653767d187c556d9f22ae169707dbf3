// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
export class Datasets extends APIResource {
    list(query = {}, options) {
        if (isRequestOptions(query)) {
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
//# sourceMappingURL=datasets.mjs.map