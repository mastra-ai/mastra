// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class AudioTracks extends APIResource {
    /**
     * Deletes additional audio tracks on a video. Deleting a default audio track is
     * not allowed. You must assign another audio track as default prior to deletion.
     *
     * @example
     * ```ts
     * const audioTrack = await client.stream.audioTracks.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, audioIdentifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/${identifier}/audio/${audioIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Adds an additional audio track to a video using the provided audio track URL.
     *
     * @example
     * ```ts
     * const audio = await client.stream.audioTracks.copy(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     label: 'director commentary',
     *   },
     * );
     * ```
     */
    copy(identifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/${identifier}/audio/copy`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Edits additional audio tracks on a video. Editing the default status of an audio
     * track to `true` will mark all other audio tracks on the video default status to
     * `false`.
     *
     * @example
     * ```ts
     * const audio = await client.stream.audioTracks.edit(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(identifier, audioIdentifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/stream/${identifier}/audio/${audioIdentifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists additional audio tracks on a video. Note this API will not return
     * information for audio attached to the video upload.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const audio of client.stream.audioTracks.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/${identifier}/audio`, AudioSinglePage, options);
    }
}
export class AudioSinglePage extends SinglePage {
}
AudioTracks.AudioSinglePage = AudioSinglePage;
//# sourceMappingURL=audio-tracks.mjs.map