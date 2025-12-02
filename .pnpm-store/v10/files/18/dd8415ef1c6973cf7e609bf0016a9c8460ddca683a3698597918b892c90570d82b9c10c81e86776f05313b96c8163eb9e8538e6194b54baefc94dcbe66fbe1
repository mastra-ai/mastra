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
exports.LOADocuments = void 0;
const resource_1 = require("../../resource.js");
const Core = __importStar(require("../../core.js"));
class LOADocuments extends resource_1.APIResource {
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
exports.LOADocuments = LOADocuments;
//# sourceMappingURL=loa-documents.js.map