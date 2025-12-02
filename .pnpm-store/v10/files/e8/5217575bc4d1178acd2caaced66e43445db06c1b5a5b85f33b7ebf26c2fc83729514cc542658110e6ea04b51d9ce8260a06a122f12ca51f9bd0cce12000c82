// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as Core from "../../../../core.mjs";
import * as VttAPI from "./vtt.mjs";
import { Vtt } from "./vtt.mjs";
export class Language extends APIResource {
    constructor() {
        super(...arguments);
        this.vtt = new VttAPI.Vtt(this._client);
    }
    /**
     * Generate captions or subtitles for provided language via AI.
     *
     * @example
     * ```ts
     * const caption =
     *   await client.stream.captions.language.create(
     *     'ea95132c15732412d22c1476fa83f27a',
     *     'tr',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(identifier, language, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/stream/${identifier}/captions/${language}/generate`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Uploads the caption or subtitle file to the endpoint for a specific BCP47
     * language. One caption or subtitle file per language is allowed.
     *
     * @example
     * ```ts
     * const caption =
     *   await client.stream.captions.language.update(
     *     'ea95132c15732412d22c1476fa83f27a',
     *     'tr',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       file: '@/Users/kyle/Desktop/tr.vtt',
     *     },
     *   );
     * ```
     */
    update(identifier, language, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/stream/${identifier}/captions/${language}`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Removes the captions or subtitles from a video.
     *
     * @example
     * ```ts
     * const language =
     *   await client.stream.captions.language.delete(
     *     'ea95132c15732412d22c1476fa83f27a',
     *     'tr',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(identifier, language, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/${identifier}/captions/${language}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists the captions or subtitles for provided language.
     *
     * @example
     * ```ts
     * const caption = await client.stream.captions.language.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   'tr',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, language, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/${identifier}/captions/${language}`, options)._thenUnwrap((obj) => obj.result);
    }
}
Language.Vtt = Vtt;
//# sourceMappingURL=language.mjs.map