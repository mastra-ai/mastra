// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../resource.mjs";
export class PageRules extends APIResource {
    /**
     * Creates a new Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   actions: [{}],
     *   targets: [{}],
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/pagerules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Replaces the configuration of an existing Page Rule. The configuration of the
     * updated Page Rule will exactly match the data passed in the API request.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     actions: [{}],
     *     targets: [{}],
     *   },
     * );
     * ```
     */
    update(pageruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/pagerules/${pageruleId}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches Page Rules in a zone.
     *
     * @example
     * ```ts
     * const pageRules = await client.pageRules.list({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/pagerules`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes an existing Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(pageruleId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/pagerules/${pageruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates one or more fields of an existing Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(pageruleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/pagerules/${pageruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a Page Rule.
     *
     * @example
     * ```ts
     * const pageRule = await client.pageRules.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(pageruleId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/pagerules/${pageruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=page-rules.mjs.map