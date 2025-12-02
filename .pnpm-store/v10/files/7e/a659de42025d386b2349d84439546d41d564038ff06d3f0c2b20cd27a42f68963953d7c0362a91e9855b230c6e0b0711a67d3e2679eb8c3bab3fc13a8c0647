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
exports.Upload = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
class Upload extends resource_1.APIResource {
    /**
     * Upload assets ahead of creating a Worker version. To learn more about the direct
     * uploads of assets, see
     * https://developers.cloudflare.com/workers/static-assets/direct-upload/.
     *
     * @example
     * ```ts
     * const upload = await client.workers.assets.upload.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   base64: true,
     *   body: { foo: 'string' },
     * });
     * ```
     */
    create(params, options) {
        const { account_id, base64, body } = params;
        return this._client.post(`/accounts/${account_id}/workers/assets/upload`, Core.multipartFormRequestOptions({ query: { base64 }, body: body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
exports.Upload = Upload;
//# sourceMappingURL=upload.js.map