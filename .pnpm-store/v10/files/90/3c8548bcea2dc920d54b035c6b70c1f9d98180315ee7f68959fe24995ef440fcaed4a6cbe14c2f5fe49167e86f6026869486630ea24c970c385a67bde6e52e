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
exports.V1ListResponsesV4PagePagination = exports.V1 = void 0;
const resource_1 = require("../../../resource.js");
const Core = __importStar(require("../../../core.js"));
const BlobsAPI = __importStar(require("./blobs.js"));
const blobs_1 = require("./blobs.js");
const KeysAPI = __importStar(require("./keys.js"));
const keys_1 = require("./keys.js");
const StatsAPI = __importStar(require("./stats.js"));
const stats_1 = require("./stats.js");
const VariantsAPI = __importStar(require("./variants.js"));
const variants_1 = require("./variants.js");
const pagination_1 = require("../../../pagination.js");
class V1 extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.keys = new KeysAPI.Keys(this._client);
        this.stats = new StatsAPI.Stats(this._client);
        this.variants = new VariantsAPI.Variants(this._client);
        this.blobs = new BlobsAPI.Blobs(this._client);
    }
    /**
     * Upload an image with up to 10 Megabytes using a single HTTP POST
     * (multipart/form-data) request. An image can be uploaded by sending an image file
     * or passing an accessible to an API url.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/images/v1`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
    /**
     * List up to 100 images with one request. Use the optional parameters below to get
     * a specific range of images.
     *
     * @deprecated
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/images/v1`, V1ListResponsesV4PagePagination, {
            query,
            ...options,
        });
    }
    /**
     * Delete an image on Cloudflare Images. On success, all copies of the image are
     * deleted and purged from cache.
     *
     * @example
     * ```ts
     * const v1 = await client.images.v1.delete('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(imageId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/images/v1/${imageId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update image access control. On access control change, all copies of the image
     * are purged from cache.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.edit('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    edit(imageId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/images/v1/${imageId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch details for a single image.
     *
     * @example
     * ```ts
     * const image = await client.images.v1.get('image_id', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(imageId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/images/v1/${imageId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.V1 = V1;
class V1ListResponsesV4PagePagination extends pagination_1.V4PagePagination {
}
exports.V1ListResponsesV4PagePagination = V1ListResponsesV4PagePagination;
V1.V1ListResponsesV4PagePagination = V1ListResponsesV4PagePagination;
V1.Keys = keys_1.Keys;
V1.Stats = stats_1.Stats;
V1.Variants = variants_1.Variants;
V1.Blobs = blobs_1.Blobs;
//# sourceMappingURL=v1.js.map