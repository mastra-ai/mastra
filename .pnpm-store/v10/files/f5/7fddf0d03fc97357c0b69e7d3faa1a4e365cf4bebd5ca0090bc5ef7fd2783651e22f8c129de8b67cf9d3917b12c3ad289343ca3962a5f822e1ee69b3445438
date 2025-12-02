"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideosSinglePage = exports.Stream = void 0;
const resource_1 = require("../../resource.js");
const AudioTracksAPI = __importStar(require("./audio-tracks.js"));
const audio_tracks_1 = require("./audio-tracks.js");
const ClipAPI = __importStar(require("./clip.js"));
const clip_1 = require("./clip.js");
const CopyAPI = __importStar(require("./copy.js"));
const copy_1 = require("./copy.js");
const DirectUploadAPI = __importStar(require("./direct-upload.js"));
const direct_upload_1 = require("./direct-upload.js");
const DownloadsAPI = __importStar(require("./downloads.js"));
const downloads_1 = require("./downloads.js");
const EmbedAPI = __importStar(require("./embed.js"));
const embed_1 = require("./embed.js");
const KeysAPI = __importStar(require("./keys.js"));
const keys_1 = require("./keys.js");
const TokenAPI = __importStar(require("./token.js"));
const token_1 = require("./token.js");
const VideosAPI = __importStar(require("./videos.js"));
const videos_1 = require("./videos.js");
const WatermarksAPI = __importStar(require("./watermarks.js"));
const watermarks_1 = require("./watermarks.js");
const WebhooksAPI = __importStar(require("./webhooks.js"));
const webhooks_1 = require("./webhooks.js");
const CaptionsAPI = __importStar(require("./captions/captions.js"));
const captions_1 = require("./captions/captions.js");
const LiveInputsAPI = __importStar(require("./live-inputs/live-inputs.js"));
const live_inputs_1 = require("./live-inputs/live-inputs.js");
const pagination_1 = require("../../pagination.js");
class Stream extends resource_1.APIResource {
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
exports.Stream = Stream;
class VideosSinglePage extends pagination_1.SinglePage {
}
exports.VideosSinglePage = VideosSinglePage;
Stream.VideosSinglePage = VideosSinglePage;
Stream.AudioTracks = audio_tracks_1.AudioTracks;
Stream.AudioSinglePage = audio_tracks_1.AudioSinglePage;
Stream.Videos = videos_1.Videos;
Stream.ClipResource = clip_1.ClipResource;
Stream.Copy = copy_1.Copy;
Stream.DirectUpload = direct_upload_1.DirectUpload;
Stream.KeyGetResponsesSinglePage = keys_1.KeyGetResponsesSinglePage;
Stream.LiveInputs = live_inputs_1.LiveInputs;
Stream.Watermarks = watermarks_1.Watermarks;
Stream.WatermarksSinglePage = watermarks_1.WatermarksSinglePage;
Stream.Webhooks = webhooks_1.Webhooks;
Stream.Captions = captions_1.Captions;
Stream.CaptionsSinglePage = captions_1.CaptionsSinglePage;
Stream.Downloads = downloads_1.Downloads;
Stream.Embed = embed_1.Embed;
Stream.Token = token_1.Token;
//# sourceMappingURL=stream.js.map