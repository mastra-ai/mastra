// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class ScheduleResource extends APIResource {
    /**
     * Creates a scheduled test for a page.
     *
     * @example
     * ```ts
     * const schedule = await client.speed.schedule.create(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(url, params, options) {
        const { zone_id, region } = params;
        return this._client.post(`/zones/${zone_id}/speed_api/schedule/${url}`, {
            query: { region },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a scheduled test for a page.
     *
     * @example
     * ```ts
     * const schedule = await client.speed.schedule.delete(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(url, params, options) {
        const { zone_id, region } = params;
        return this._client.delete(`/zones/${zone_id}/speed_api/schedule/${url}`, {
            query: { region },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves the test schedule for a page in a specific region.
     *
     * @example
     * ```ts
     * const schedule = await client.speed.schedule.get(
     *   'example.com',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(url, params, options) {
        const { zone_id, ...query } = params;
        return this._client.get(`/zones/${zone_id}/speed_api/schedule/${url}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=schedule.mjs.map