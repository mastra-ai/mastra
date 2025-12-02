import { APIResource } from "../../../resource.js";
import * as Core from "../../../core.js";
import * as LanguageAPI from "./language/language.js";
import { Language, LanguageCreateParams, LanguageDeleteParams, LanguageDeleteResponse, LanguageGetParams, LanguageUpdateParams } from "./language/language.js";
import { SinglePage } from "../../../pagination.js";
export declare class Captions extends APIResource {
    language: LanguageAPI.Language;
    /**
     * Lists the available captions or subtitles for a specific video.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const caption of client.stream.captions.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    get(identifier: string, params: CaptionGetParams, options?: Core.RequestOptions): Core.PagePromise<CaptionsSinglePage, Caption>;
}
export declare class CaptionsSinglePage extends SinglePage<Caption> {
}
export interface Caption {
    /**
     * Whether the caption was generated via AI.
     */
    generated?: boolean;
    /**
     * The language label displayed in the native language to users.
     */
    label?: string;
    /**
     * The language tag in BCP 47 format.
     */
    language?: string;
    /**
     * The status of a generated caption.
     */
    status?: 'ready' | 'inprogress' | 'error';
}
export interface CaptionGetParams {
    /**
     * Identifier.
     */
    account_id: string;
}
export declare namespace Captions {
    export { type Caption as Caption, CaptionsSinglePage as CaptionsSinglePage, type CaptionGetParams as CaptionGetParams, };
    export { Language as Language, type LanguageDeleteResponse as LanguageDeleteResponse, type LanguageCreateParams as LanguageCreateParams, type LanguageUpdateParams as LanguageUpdateParams, type LanguageDeleteParams as LanguageDeleteParams, type LanguageGetParams as LanguageGetParams, };
}
//# sourceMappingURL=captions.d.ts.map