import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as DatasetsAPI from "./datasets.js";
import { type BlobLike } from "../../../../uploads.js";
export declare class Upload extends APIResource {
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
    create(datasetId: string, params: UploadCreateParams, options?: Core.RequestOptions): Core.APIPromise<NewVersion>;
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
    edit(datasetId: string, version: number, params: UploadEditParams, options?: Core.RequestOptions): Core.APIPromise<DatasetsAPI.Dataset>;
}
export interface NewVersion {
    encoding_version: number;
    max_cells: number;
    version: number;
    case_sensitive?: boolean;
    columns?: Array<NewVersion.Column>;
    secret?: string;
}
export declare namespace NewVersion {
    interface Column {
        entry_id: string;
        header_name: string;
        num_cells: number;
        upload_status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';
    }
}
export interface UploadCreateParams {
    account_id: string;
}
export interface UploadEditParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body: string | ArrayBufferView | ArrayBuffer | BlobLike;
}
export declare namespace Upload {
    export { type NewVersion as NewVersion, type UploadCreateParams as UploadCreateParams, type UploadEditParams as UploadEditParams, };
}
//# sourceMappingURL=upload.d.ts.map