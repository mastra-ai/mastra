// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Bookmarks extends APIResource {
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
export class BookmarksSinglePage extends SinglePage {
}
Bookmarks.BookmarksSinglePage = BookmarksSinglePage;
//# sourceMappingURL=bookmarks.mjs.map