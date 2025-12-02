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
exports.DirectUploads = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
class DirectUploads extends resource_1.APIResource {
    /**
     * Direct uploads allow users to upload images without API keys. A common use case
     * are web apps, client-side applications, or mobile devices where users upload
     * content directly to Cloudflare Images. This method creates a draft record for a
     * future image. It returns an upload URL and an image identifier. To verify if the
     * image itself has been uploaded, send an image details request
     * (accounts/:account_identifier/images/v1/:identifier), and check that the
     * `draft: true` property is not present.
     *
     * @example
     * ```ts
     * const directUpload =
     *   await client.images.v2.directUploads.create({
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/images/v2/direct_upload`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
exports.DirectUploads = DirectUploads;
//# sourceMappingURL=direct-uploads.js.map