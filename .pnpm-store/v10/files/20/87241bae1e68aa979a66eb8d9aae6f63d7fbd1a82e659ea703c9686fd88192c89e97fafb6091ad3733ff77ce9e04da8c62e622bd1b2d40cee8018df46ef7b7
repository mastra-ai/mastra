// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
export class Collections extends APIResource {
    /**
     * Deletes a collection.
     *
     * A `404 Not Found` status code will be returned, if the provided collection name
     * does not exist.
     */
    delete(body, options) {
        return this._client.post('/collections/delete-collection', { body, ...options });
    }
    /**
     * Adds a collection.
     *
     * If the collection already exists, a `409 Conflict` status code will be returned.
     */
    add(body, options) {
        return this._client.post('/collections/add-collection', { body, ...options });
    }
    /**
     * Gets a complete list of all of your collections.
     */
    getList(body, options) {
        return this._client.post('/collections/get-collection-list', { body, ...options });
    }
}
//# sourceMappingURL=collections.mjs.map