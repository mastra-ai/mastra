"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentGetInfoListResponsesGetDocumentInfoListCursor = exports.Documents = void 0;
const resource_1 = require("../resource.js");
const pagination_1 = require("../pagination.js");
class Documents extends resource_1.APIResource {
    /**
     * Updates a document. This endpoint is atomic.
     *
     * Currently both `metadata` and `index_status` are supported.
     *
     * - When updating with a non-null `metadata`, the document must have
     *   `index_status` of `indexed`. After this call, the document will have an
     *   `index_status` of `not_indexed`, since the document will need to reindex with
     *   the new metadata.
     * - When updating with a non-null `index_status`, setting it to
     *   `not_parsed or `not_indexed`requires that the document must have`index_status`of`parsing_failed`or`indexing_failed`,
     *   respectively.
     *
     * A `404 Not Found` status code will be returned, if the provided collection name
     * or document path does not exist.
     */
    update(body, options) {
        return this._client.post('/documents/update-document', { body, ...options });
    }
    /**
     * Deletes a document
     *
     * A `404 Not Found` status code will be returned, if the provided collection name
     * or document path does not exist.
     */
    delete(body, options) {
        return this._client.post('/documents/delete-document', { body, ...options });
    }
    /**
     * Adds a document to a given collection.
     *
     * A status code of `201 Created` will be returned if a document was successfully
     * added. A status code of `409 Conflict` will be returned if the given collection
     * already has a document with the same path.
     *
     * If `overwrite` is given a value of `true`, then a status code of `200 OK` will
     * be returned if a document was overwritten (Rather than a status code of
     * `409 Conflict`).
     *
     * When a document is inserted, it can take time to appear in the index. Check the
     * `/status/get-status` endpoint to see progress.
     */
    add(body, options) {
        return this._client.post('/documents/add-document', { body, ...options });
    }
    /**
     * Retrieves information about a specific document. The request parameters define
     * what information you would like to receive.
     *
     * A `404 Not Found` will be returned if either the collection name does not exist,
     * or the document path does not exist within the provided collection.
     */
    getInfo(body, options) {
        return this._client.post('/documents/get-document-info', { body, ...options });
    }
    /**
     * Retrives a list of document metadata information that matches the provided
     * filters.
     *
     * The documents returned will be sorted by path in lexicographically ascending
     * order. `path_gt` can be used for pagination, and should be set to the path of
     * the last document returned in the previous call.
     *
     * A `404 Not Found` will be returned if either the collection name does not exist,
     * or the document path does not exist within the provided collection.
     */
    getInfoList(body, options) {
        return this._client.getAPIList('/documents/get-document-info-list', DocumentGetInfoListResponsesGetDocumentInfoListCursor, { body, method: 'post', ...options });
    }
    /**
     * Retrieves information about a specific page. The request parameters define what
     * information you would like to receive.
     *
     * A `404 Not Found` will be returned if either the collection name does not exist,
     * or the document path does not exist within the provided collection.
     */
    getPageInfo(body, options) {
        return this._client.post('/documents/get-page-info', { body, ...options });
    }
}
exports.Documents = Documents;
class DocumentGetInfoListResponsesGetDocumentInfoListCursor extends pagination_1.GetDocumentInfoListCursor {
}
exports.DocumentGetInfoListResponsesGetDocumentInfoListCursor = DocumentGetInfoListResponsesGetDocumentInfoListCursor;
Documents.DocumentGetInfoListResponsesGetDocumentInfoListCursor =
    DocumentGetInfoListResponsesGetDocumentInfoListCursor;
//# sourceMappingURL=documents.js.map