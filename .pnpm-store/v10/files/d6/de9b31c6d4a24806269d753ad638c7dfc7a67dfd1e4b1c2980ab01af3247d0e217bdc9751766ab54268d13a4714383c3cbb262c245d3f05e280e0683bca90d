// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
import * as BlobsAPI from "./blobs.mjs";
import { Blobs } from "./blobs.mjs";
import * as KeysAPI from "./keys.mjs";
import { Keys, } from "./keys.mjs";
import * as StatsAPI from "./stats.mjs";
import { Stats } from "./stats.mjs";
import * as VariantsAPI from "./variants.mjs";
import { Variants, } from "./variants.mjs";
import { V4PagePagination } from "../../../pagination.mjs";
export class V1 extends APIResource {
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
export class V1ListResponsesV4PagePagination extends V4PagePagination {
}
V1.V1ListResponsesV4PagePagination = V1ListResponsesV4PagePagination;
V1.Keys = Keys;
V1.Stats = Stats;
V1.Variants = Variants;
V1.Blobs = Blobs;
//# sourceMappingURL=v1.mjs.map