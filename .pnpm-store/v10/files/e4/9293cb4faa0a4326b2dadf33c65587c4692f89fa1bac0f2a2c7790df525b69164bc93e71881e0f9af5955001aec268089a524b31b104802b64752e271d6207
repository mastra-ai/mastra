import { APIResource } from "../../resource.js";
import * as Core from "../../core.js";
import { type Response } from "../../_shims/index.js";
export declare class LOADocuments extends APIResource {
    /**
     * Submit LOA document (pdf format) under the account.
     *
     * @example
     * ```ts
     * const loaDocument =
     *   await client.addressing.loaDocuments.create({
     *     account_id: '258def64c72dae45f3e4c8516e2111f2',
     *     loa_document: '@document.pdf',
     *   });
     * ```
     */
    create(params: LOADocumentCreateParams, options?: Core.RequestOptions): Core.APIPromise<LOADocumentCreateResponse>;
    /**
     * Download specified LOA document under the account.
     *
     * @example
     * ```ts
     * const loaDocument =
     *   await client.addressing.loaDocuments.get(
     *     'd933b1530bc56c9953cf8ce166da8004',
     *     { account_id: '258def64c72dae45f3e4c8516e2111f2' },
     *   );
     *
     * const content = await loaDocument.blob();
     * console.log(content);
     * ```
     */
    get(loaDocumentId: string | null, params: LOADocumentGetParams, options?: Core.RequestOptions): Core.APIPromise<Response>;
}
export interface LOADocumentCreateResponse {
    /**
     * Identifier for the uploaded LOA document.
     */
    id?: string | null;
    /**
     * Identifier of a Cloudflare account.
     */
    account_id?: string;
    created?: string;
    /**
     * Name of LOA document. Max file size 10MB, and supported filetype is pdf.
     */
    filename?: string;
    /**
     * File size of the uploaded LOA document.
     */
    size_bytes?: number;
    /**
     * Whether the LOA has been verified by Cloudflare staff.
     */
    verified?: boolean;
    /**
     * Timestamp of the moment the LOA was marked as validated.
     */
    verified_at?: string | null;
}
export interface LOADocumentCreateParams {
    /**
     * Path param: Identifier of a Cloudflare account.
     */
    account_id: string;
    /**
     * Body param: LOA document to upload.
     */
    loa_document: string;
}
export interface LOADocumentGetParams {
    /**
     * Identifier of a Cloudflare account.
     */
    account_id: string;
}
export declare namespace LOADocuments {
    export { type LOADocumentCreateResponse as LOADocumentCreateResponse, type LOADocumentCreateParams as LOADocumentCreateParams, type LOADocumentGetParams as LOADocumentGetParams, };
}
//# sourceMappingURL=loa-documents.d.ts.map