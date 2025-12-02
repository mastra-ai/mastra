"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Pipelines = void 0;
const resource_1 = require("../resource.js");
class Pipelines extends resource_1.APIResource {
    /**
     * Create a new pipeline.
     *
     * @example
     * ```ts
     * const pipeline = await client.pipelines.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   destination: {
     *     batch: {},
     *     compression: {},
     *     credentials: {
     *       access_key_id: '<access key id>',
     *       endpoint:
     *         'https://123f8a8258064ed892a347f173372359.r2.cloudflarestorage.com',
     *       secret_access_key: '<secret key>',
     *     },
     *     format: 'json',
     *     path: { bucket: 'bucket' },
     *     type: 'r2',
     *   },
     *   name: 'sample_pipeline',
     *   source: [{ format: 'json', type: 'type' }],
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/pipelines`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing pipeline.
     *
     * @example
     * ```ts
     * const pipeline = await client.pipelines.update(
     *   'sample_pipeline',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     destination: {
     *       batch: {},
     *       compression: {},
     *       format: 'json',
     *       path: { bucket: 'bucket' },
     *       type: 'r2',
     *     },
     *     name: 'sample_pipeline',
     *     source: [{ format: 'json', type: 'type' }],
     *   },
     * );
     * ```
     */
    update(pipelineName, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/pipelines/${pipelineName}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List, filter, and paginate pipelines in an account.
     *
     * @example
     * ```ts
     * const pipelines = await client.pipelines.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/pipelines`, { query, ...options });
    }
    /**
     * Delete a pipeline.
     *
     * @example
     * ```ts
     * await client.pipelines.delete('sample_pipeline', {
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(pipelineName, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/pipelines/${pipelineName}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Get configuration of a pipeline.
     *
     * @example
     * ```ts
     * const pipeline = await client.pipelines.get(
     *   'sample_pipeline',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(pipelineName, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/pipelines/${pipelineName}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Pipelines = Pipelines;
//# sourceMappingURL=pipelines.js.map