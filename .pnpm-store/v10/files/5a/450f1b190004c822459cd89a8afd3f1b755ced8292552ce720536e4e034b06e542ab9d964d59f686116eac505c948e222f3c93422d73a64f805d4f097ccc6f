// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as LanguageAPI from "./language/language.mjs";
import { Language, } from "./language/language.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Captions extends APIResource {
    constructor() {
        super(...arguments);
        this.language = new LanguageAPI.Language(this._client);
    }
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
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/${identifier}/captions`, CaptionsSinglePage, options);
    }
}
export class CaptionsSinglePage extends SinglePage {
}
Captions.CaptionsSinglePage = CaptionsSinglePage;
Captions.Language = Language;
//# sourceMappingURL=captions.mjs.map