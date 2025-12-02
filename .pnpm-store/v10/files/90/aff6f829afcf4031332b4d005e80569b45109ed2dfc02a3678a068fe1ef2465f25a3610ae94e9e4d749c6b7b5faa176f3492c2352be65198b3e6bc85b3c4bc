// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Settings extends APIResource {
    /**
     * Update zone-level Waiting Room settings
     *
     * @example
     * ```ts
     * const setting = await client.waitingRooms.settings.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/waiting_rooms/settings`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch zone-level Waiting Room settings
     *
     * @example
     * ```ts
     * const response = await client.waitingRooms.settings.edit({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(params, options) {
        const { zone_id, ...body } = params;
        return this._client.patch(`/zones/${zone_id}/waiting_rooms/settings`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get zone-level Waiting Room settings
     *
     * @example
     * ```ts
     * const setting = await client.waitingRooms.settings.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/waiting_rooms/settings`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=settings.mjs.map