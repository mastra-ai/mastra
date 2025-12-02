// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage, V4PagePaginationArray } from "../../pagination.mjs";
export class Database extends APIResource {
    /**
     * Returns the created D1 database.
     *
     * @example
     * ```ts
     * const d1 = await client.d1.database.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'my-database',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/d1/database`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates the specified D1 database.
     *
     * @example
     * ```ts
     * const d1 = await client.d1.database.update(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     read_replication: { mode: 'auto' },
     *   },
     * );
     * ```
     */
    update(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/d1/database/${databaseId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns a list of D1 databases.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const databaseListResponse of client.d1.database.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/d1/database`, DatabaseListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes the specified D1 database.
     *
     * @example
     * ```ts
     * const database = await client.d1.database.delete(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(databaseId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/d1/database/${databaseId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates partially the specified D1 database.
     *
     * @example
     * ```ts
     * const d1 = await client.d1.database.edit(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/d1/database/${databaseId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns a URL where the SQL contents of your D1 can be downloaded. Note: this
     * process may take some time for larger DBs, during which your D1 will be
     * unavailable to serve queries. To avoid blocking your DB unnecessarily, an
     * in-progress export must be continually polled or will automatically cancel.
     *
     * @example
     * ```ts
     * const response = await client.d1.database.export(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     output_format: 'polling',
     *   },
     * );
     * ```
     */
    export(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/d1/database/${databaseId}/export`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the specified D1 database.
     *
     * @example
     * ```ts
     * const d1 = await client.d1.database.get(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(databaseId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/d1/database/${databaseId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Generates a temporary URL for uploading an SQL file to, then instructing the D1
     * to import it and polling it for status updates. Imports block the D1 for their
     * duration.
     *
     * @example
     * ```ts
     * const response = await client.d1.database.import(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     action: 'init',
     *     etag: 'etag',
     *   },
     * );
     * ```
     */
    import(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/d1/database/${databaseId}/import`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Returns the query result as an object.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const queryResult of client.d1.database.query(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     sql: 'SELECT * FROM myTable WHERE field = ? OR field = ?;',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    query(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/d1/database/${databaseId}/query`, QueryResultsSinglePage, { body, method: 'post', ...options });
    }
    /**
     * Returns the query result rows as arrays rather than objects. This is a
     * performance-optimized version of the /query endpoint.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const databaseRawResponse of client.d1.database.raw(
     *   'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     sql: 'SELECT * FROM myTable WHERE field = ? OR field = ?;',
     *   },
     * )) {
     *   // ...
     * }
     * ```
     */
    raw(databaseId, params, options) {
        const { account_id, ...body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/d1/database/${databaseId}/raw`, DatabaseRawResponsesSinglePage, { body, method: 'post', ...options });
    }
}
export class DatabaseListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
export class QueryResultsSinglePage extends SinglePage {
}
export class DatabaseRawResponsesSinglePage extends SinglePage {
}
Database.DatabaseListResponsesV4PagePaginationArray = DatabaseListResponsesV4PagePaginationArray;
Database.QueryResultsSinglePage = QueryResultsSinglePage;
Database.DatabaseRawResponsesSinglePage = DatabaseRawResponsesSinglePage;
//# sourceMappingURL=database.mjs.map