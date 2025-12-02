import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
export declare class Datasets extends APIResource {
    /**
     * Retrieves a list of datasets.
     *
     * @example
     * ```ts
     * const datasets = await client.radar.datasets.list();
     * ```
     */
    list(query?: DatasetListParams, options?: Core.RequestOptions): Core.APIPromise<DatasetListResponse>;
    list(options?: Core.RequestOptions): Core.APIPromise<DatasetListResponse>;
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
    download(params: DatasetDownloadParams, options?: Core.RequestOptions): Core.APIPromise<DatasetDownloadResponse>;
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
    get(alias: string, options?: Core.RequestOptions): Core.APIPromise<string>;
}
export interface DatasetListResponse {
    datasets: Array<DatasetListResponse.Dataset>;
}
export declare namespace DatasetListResponse {
    interface Dataset {
        id: number;
        description: string;
        meta: unknown;
        tags: Array<string>;
        title: string;
        type: string;
    }
}
export interface DatasetDownloadResponse {
    dataset: DatasetDownloadResponse.Dataset;
}
export declare namespace DatasetDownloadResponse {
    interface Dataset {
        url: string;
    }
}
export type DatasetGetResponse = string;
export interface DatasetListParams {
    /**
     * Filters results by dataset type.
     */
    datasetType?: 'RANKING_BUCKET' | 'REPORT';
    /**
     * Filters results by the specified date.
     */
    date?: string;
    /**
     * Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
    /**
     * Limits the number of objects returned in the response.
     */
    limit?: number;
    /**
     * Skips the specified number of objects before fetching the results.
     */
    offset?: number;
}
export interface DatasetDownloadParams {
    /**
     * Body param:
     */
    datasetId: number;
    /**
     * Query param: Format in which results will be returned.
     */
    format?: 'JSON' | 'CSV';
}
export declare namespace Datasets {
    export { type DatasetListResponse as DatasetListResponse, type DatasetDownloadResponse as DatasetDownloadResponse, type DatasetGetResponse as DatasetGetResponse, type DatasetListParams as DatasetListParams, type DatasetDownloadParams as DatasetDownloadParams, };
}
//# sourceMappingURL=datasets.d.ts.map