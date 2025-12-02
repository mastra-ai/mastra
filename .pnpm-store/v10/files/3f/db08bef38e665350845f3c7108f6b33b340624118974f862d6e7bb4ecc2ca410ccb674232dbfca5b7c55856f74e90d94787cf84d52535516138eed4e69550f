"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BookmarksSinglePage = exports.Bookmarks = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Bookmarks extends resource_1.APIResource {
    /**
     * Create a new Bookmark application.
     *
     * @deprecated
     */
    create(bookmarkId, params, options) {
        const { account_id, body } = params;
        return this._client.post(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Bookmark application.
     *
     * @deprecated
     */
    update(bookmarkId, params, options) {
        const { account_id, body } = params;
        return this._client.put(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Bookmark applications.
     *
     * @deprecated
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/bookmarks`, BookmarksSinglePage, options);
    }
    /**
     * Deletes a Bookmark application.
     *
     * @deprecated
     */
    delete(bookmarkId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Bookmark application.
     *
     * @deprecated
     */
    get(bookmarkId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/bookmarks/${bookmarkId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Bookmarks = Bookmarks;
class BookmarksSinglePage extends pagination_1.SinglePage {
}
exports.BookmarksSinglePage = BookmarksSinglePage;
Bookmarks.BookmarksSinglePage = BookmarksSinglePage;
//# sourceMappingURL=bookmarks.js.map