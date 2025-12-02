"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Vtt = void 0;
const resource_1 = require("../../../../resource.js");
class Vtt extends resource_1.APIResource {
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
exports.Vtt = Vtt;
//# sourceMappingURL=vtt.js.map