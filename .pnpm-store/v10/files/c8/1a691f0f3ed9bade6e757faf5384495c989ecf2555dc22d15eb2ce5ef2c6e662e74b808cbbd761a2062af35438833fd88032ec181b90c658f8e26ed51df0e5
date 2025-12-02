// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class ClipResource extends APIResource {
    /**
     * Clips a video based on the specified start and end times provided in seconds.
     *
     * @example
     * ```ts
     * const clip = await client.stream.clip.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   clippedFromVideoUID: '023e105f4ecef8ad9ca31a8372d0c353',
     *   endTimeSeconds: 0,
     *   startTimeSeconds: 0,
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/clip`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=clip.mjs.map