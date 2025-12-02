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
exports.WatermarksSinglePage = exports.Watermarks = void 0;
const resource_1 = require("../../resource.js");
const Core = __importStar(require("../../core.js"));
const pagination_1 = require("../../pagination.js");
class Watermarks extends resource_1.APIResource {
    /**
     * Creates watermark profiles using a single `HTTP POST multipart/form-data`
     * request.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   file: '@/Users/rchen/Downloads/watermark.png',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/watermarks`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all watermark profiles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const watermark of client.stream.watermarks.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/watermarks`, WatermarksSinglePage, options);
    }
    /**
     * Deletes a watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.delete(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(identifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/watermarks/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves details for a single watermark profile.
     *
     * @example
     * ```ts
     * const watermark = await client.stream.watermarks.get(
     *   'ea95132c15732412d22c1476fa83f27a',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(identifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/watermarks/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Watermarks = Watermarks;
class WatermarksSinglePage extends pagination_1.SinglePage {
}
exports.WatermarksSinglePage = WatermarksSinglePage;
Watermarks.WatermarksSinglePage = WatermarksSinglePage;
//# sourceMappingURL=watermarks.js.map