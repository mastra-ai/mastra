"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputsSinglePage = exports.Outputs = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Outputs extends resource_1.APIResource {
    /**
     * Creates a new output that can be used to simulcast or restream live video to
     * other RTMP or SRT destinations. Outputs are always linked to a specific live
     * input — one live input can have many outputs.
     *
     * @example
     * ```ts
     * const output =
     *   await client.stream.liveInputs.outputs.create(
     *     '66be4bf738797e01e1fca35a7bdecdcd',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       streamKey: 'uzya-f19y-g2g9-a2ee-51j2',
     *       url: 'rtmp://a.rtmp.youtube.com/live2',
     *     },
     *   );
     * ```
     */
    create(liveInputIdentifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}/outputs`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates the state of an output.
     *
     * @example
     * ```ts
     * const output =
     *   await client.stream.liveInputs.outputs.update(
     *     '66be4bf738797e01e1fca35a7bdecdcd',
     *     'baea4d9c515887b80289d5c33cf01145',
     *     {
     *       account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       enabled: true,
     *     },
     *   );
     * ```
     */
    update(liveInputIdentifier, outputIdentifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}/outputs/${outputIdentifier}`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieves all outputs associated with a specified live input.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const output of client.stream.liveInputs.outputs.list(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(liveInputIdentifier, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}/outputs`, OutputsSinglePage, options);
    }
    /**
     * Deletes an output and removes it from the associated live input.
     *
     * @example
     * ```ts
     * await client.stream.liveInputs.outputs.delete(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   'baea4d9c515887b80289d5c33cf01145',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(liveInputIdentifier, outputIdentifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}/outputs/${outputIdentifier}`, { ...options, headers: { Accept: '*/*', ...options?.headers } });
    }
}
exports.Outputs = Outputs;
class OutputsSinglePage extends pagination_1.SinglePage {
}
exports.OutputsSinglePage = OutputsSinglePage;
Outputs.OutputsSinglePage = OutputsSinglePage;
//# sourceMappingURL=outputs.js.map