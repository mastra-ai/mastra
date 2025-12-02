import { APIResource } from "../../../../resource.js";
import * as Core from "../../../../core.js";
import * as CaptionsAPI from "../captions.js";
import * as VttAPI from "./vtt.js";
import { Vtt, VttGetParams, VttGetResponse } from "./vtt.js";
export declare class Language extends APIResource {
    vtt: VttAPI.Vtt;
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
    create(identifier: string, language: string, params: LanguageCreateParams, options?: Core.RequestOptions): Core.APIPromise<CaptionsAPI.Caption>;
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
    update(identifier: string, language: string, params: LanguageUpdateParams, options?: Core.RequestOptions): Core.APIPromise<CaptionsAPI.Caption>;
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
    delete(identifier: string, language: string, params: LanguageDeleteParams, options?: Core.RequestOptions): Core.APIPromise<LanguageDeleteResponse>;
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
    get(identifier: string, language: string, params: LanguageGetParams, options?: Core.RequestOptions): Core.APIPromise<CaptionsAPI.Caption>;
}
export type LanguageDeleteResponse = string;
export interface LanguageCreateParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface LanguageUpdateParams {
    /**
     * Path param: Identifier.
     */
    account_id: string;
    /**
     * Body param: The WebVTT file containing the caption or subtitle content.
     */
    file: string;
}
export interface LanguageDeleteParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export interface LanguageGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Language {
    export { type LanguageDeleteResponse as LanguageDeleteResponse, type LanguageCreateParams as LanguageCreateParams, type LanguageUpdateParams as LanguageUpdateParams, type LanguageDeleteParams as LanguageDeleteParams, type LanguageGetParams as LanguageGetParams, };
    export { Vtt as Vtt, type VttGetResponse as VttGetResponse, type VttGetParams as VttGetParams };
}
//# sourceMappingURL=language.d.ts.map