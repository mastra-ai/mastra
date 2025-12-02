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
exports.V2 = void 0;
const resource_1 = require("../../../resource.js");
const DirectUploadsAPI = __importStar(require("./direct-uploads.js"));
const direct_uploads_1 = require("./direct-uploads.js");
class V2 extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.directUploads = new DirectUploadsAPI.DirectUploads(this._client);
    }
    /**
     * List up to 10000 images with one request. Use the optional parameters below to
     * get a specific range of images. Endpoint returns continuation_token if more
     * images are present.
     *
     * @example
     * ```ts
     * const v2s = await client.images.v2.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/images/v2`, { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.V2 = V2;
V2.DirectUploads = direct_uploads_1.DirectUploads;
//# sourceMappingURL=v2.js.map