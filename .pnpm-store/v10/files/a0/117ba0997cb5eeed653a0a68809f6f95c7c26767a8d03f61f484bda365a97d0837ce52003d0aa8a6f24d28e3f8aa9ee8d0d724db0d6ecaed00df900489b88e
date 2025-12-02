// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AudioTracksAPI from "./audio-tracks.mjs";
import { AudioSinglePage, AudioTracks, } from "./audio-tracks.mjs";
import * as ClipAPI from "./clip.mjs";
import { ClipResource } from "./clip.mjs";
import * as CopyAPI from "./copy.mjs";
import { Copy } from "./copy.mjs";
import * as DirectUploadAPI from "./direct-upload.mjs";
import { DirectUpload } from "./direct-upload.mjs";
import * as DownloadsAPI from "./downloads.mjs";
import { Downloads, } from "./downloads.mjs";
import * as EmbedAPI from "./embed.mjs";
import { Embed } from "./embed.mjs";
import * as KeysAPI from "./keys.mjs";
import { KeyGetResponsesSinglePage, } from "./keys.mjs";
import * as TokenAPI from "./token.mjs";
import { Token } from "./token.mjs";
import * as VideosAPI from "./videos.mjs";
import { Videos } from "./videos.mjs";
import * as WatermarksAPI from "./watermarks.mjs";
import { Watermarks, WatermarksSinglePage, } from "./watermarks.mjs";
import * as WebhooksAPI from "./webhooks.mjs";
import { Webhooks, } from "./webhooks.mjs";
import * as CaptionsAPI from "./captions/captions.mjs";
import { Captions, CaptionsSinglePage } from "./captions/captions.mjs";
import * as LiveInputsAPI from "./live-inputs/live-inputs.mjs";
import { LiveInputs, } from "./live-inputs/live-inputs.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Stream extends APIResource {
    constructor() {
        super(...arguments);
        this.audioTracks = new AudioTracksAPI.AudioTracks(this._client);
        this.videos = new VideosAPI.Videos(this._client);
        this.clip = new ClipAPI.ClipResource(this._client);
        this.copy = new CopyAPI.Copy(this._client);
        this.directUpload = new DirectUploadAPI.DirectUpload(this._client);
        this.keys = new KeysAPI.Keys(this._client);
        this.liveInputs = new LiveInputsAPI.LiveInputs(this._client);
        this.watermarks = new WatermarksAPI.Watermarks(this._client);
        this.webhooks = new WebhooksAPI.Webhooks(this._client);
        this.captions = new CaptionsAPI.Captions(this._client);
        this.downloads = new DownloadsAPI.Downloads(this._client);
        this.embed = new EmbedAPI.Embed(this._client);
        this.token = new TokenAPI.Token(this._client);
    }
    /**
     * Initiates a video upload using the TUS protocol. On success, the server responds
     * with a status code 201 (created) and includes a `location` header to indicate
     * where the content should be uploaded. Refer to https://tus.io for protocol
     * details.
     *
     * @example
     * ```ts
     * await client.stream.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   body: {},
     *   'Tus-Resumable': '1.0.0',
     *   'Upload-Length': 0,
     * });
     * ```
     */
    create(params, options) {
        const { account_id, body, 'Tus-Resumable': tusResumable, 'Upload-Length': uploadLength, direct_user, 'Upload-Creator': uploadCreator, 'Upload-Metadata': uploadMetadata, } = params;
        return this._client.post(`/accounts/${account_id}/stream`, {
            query: { direct_user },
            body: body,
            ...options,
            headers: {
                Accept: '*/*',
                'Tus-Resumable': tusResumable.toString(),
                'Upload-Length': uploadLength.toString(),
                ...(uploadCreator != null ? { 'Upload-Creator': uploadCreator } : undefined),
                ...(uploadMetadata != null ? { 'Upload-Metadata': uploadMetadata } : undefined),
                ...options?.headers,
            },
        });
    }
    /**
     * Lists up to 1000 videos from a single request. For a specific range, refer to
     * the optional parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const video of client.stream.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream`, VideosSinglePage, { query, ...options });
    }
    /**
     * Deletes a video and its copies from Cloudflare Stream.
     *
     * @example
     * ```ts
     * await client.stream.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/${identifier}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Edit details for a single video.
     *
     * @example
     * ```ts
     * const video = await client.stream.edit(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(identifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/${identifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches details for a single video.
     *
     * @example
     * ```ts
     * const video = await client.stream.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class VideosSinglePage extends SinglePage {
}
Stream.VideosSinglePage = VideosSinglePage;
Stream.AudioTracks = AudioTracks;
Stream.AudioSinglePage = AudioSinglePage;
Stream.Videos = Videos;
Stream.ClipResource = ClipResource;
Stream.Copy = Copy;
Stream.DirectUpload = DirectUpload;
Stream.KeyGetResponsesSinglePage = KeyGetResponsesSinglePage;
Stream.LiveInputs = LiveInputs;
Stream.Watermarks = Watermarks;
Stream.WatermarksSinglePage = WatermarksSinglePage;
Stream.Webhooks = Webhooks;
Stream.Captions = Captions;
Stream.CaptionsSinglePage = CaptionsSinglePage;
Stream.Downloads = Downloads;
Stream.Embed = Embed;
Stream.Token = Token;
//# sourceMappingURL=stream.mjs.map