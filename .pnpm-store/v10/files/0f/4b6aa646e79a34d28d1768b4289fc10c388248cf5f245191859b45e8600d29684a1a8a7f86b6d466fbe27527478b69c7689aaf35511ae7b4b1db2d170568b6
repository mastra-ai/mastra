// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
export class Vtt extends APIResource {
    /**
     * Return WebVTT captions for a provided language.
     *
     * @example
     * ```ts
     * const vtt = await client.stream.captions.language.vtt.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   'tr',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, language, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/${identifier}/captions/${language}/vtt`, {
            ...options,
            headers: { Accept: 'text/vtt', ...options?.headers },
        });
    }
}
//# sourceMappingURL=vtt.mjs.map