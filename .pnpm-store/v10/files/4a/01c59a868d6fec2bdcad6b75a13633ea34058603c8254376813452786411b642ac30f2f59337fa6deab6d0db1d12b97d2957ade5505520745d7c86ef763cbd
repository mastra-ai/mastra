// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as Core from "../../core.mjs";
export class LOADocuments extends APIResource {
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
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/addressing/loa_documents`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
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
    get(loaDocumentId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/addressing/loa_documents/${loaDocumentId}/download`, {
            ...options,
            headers: { Accept: 'application/pdf', ...options?.headers },
            __binaryResponse: true,
        });
    }
}
//# sourceMappingURL=loa-documents.mjs.map