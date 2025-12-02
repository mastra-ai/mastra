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
exports.Language = void 0;
const resource_1 = require("../../../../resource.js");
const Core = __importStar(require("../../../../core.js"));
const VttAPI = __importStar(require("./vtt.js"));
const vtt_1 = require("./vtt.js");
class Language extends resource_1.APIResource {
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
exports.Language = Language;
Language.Vtt = vtt_1.Vtt;
//# sourceMappingURL=language.js.map