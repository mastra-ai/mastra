import { APIResource } from "../../../../../resource.js";
import * as Core from "../../../../../core.js";
import * as EntriesAPI from "./entries.js";
import { Entries, EntryCreateParams, EntryCreateResponse } from "./entries.js";
import { SinglePage } from "../../../../../pagination.js";
export declare class Versions extends APIResource {
    entries: EntriesAPI.Entries;
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
    create(datasetId: string, version: number, params: VersionCreateParams, options?: Core.RequestOptions): Core.PagePromise<VersionCreateResponsesSinglePage, VersionCreateResponse>;
}
export declare class VersionCreateResponsesSinglePage extends SinglePage<VersionCreateResponse> {
}
export interface VersionCreateResponse {
    entry_id: string;
    header_name: string;
    num_cells: number;
    upload_status: 'empty' | 'uploading' | 'pending' | 'processing' | 'failed' | 'complete';
}
export interface VersionCreateParams {
    /**
     * Path param:
     */
    account_id: string;
    /**
     * Body param:
     */
    body: Array<VersionCreateParams.ExistingColumn | VersionCreateParams.NewColumn>;
}
export declare namespace VersionCreateParams {
    interface ExistingColumn {
        entry_id: string;
        header_name?: string;
        num_cells?: number;
    }
    interface NewColumn {
        entry_name: string;
        header_name?: string;
        num_cells?: number;
    }
}
export declare namespace Versions {
    export { type VersionCreateResponse as VersionCreateResponse, VersionCreateResponsesSinglePage as VersionCreateResponsesSinglePage, type VersionCreateParams as VersionCreateParams, };
    export { Entries as Entries, type EntryCreateResponse as EntryCreateResponse, type EntryCreateParams as EntryCreateParams, };
}
//# sourceMappingURL=versions.d.ts.map