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
exports.LiveInputs = void 0;
const resource_1 = require("../../../resource.js");
const OutputsAPI = __importStar(require("./outputs.js"));
const outputs_1 = require("./outputs.js");
class LiveInputs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.outputs = new OutputsAPI.Outputs(this._client);
    }
    /**
     * Creates a live input, and returns credentials that you or your users can use to
     * stream live video to Cloudflare Stream.
     *
     * @example
     * ```ts
     * const liveInput = await client.stream.liveInputs.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/stream/live_inputs`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a specified live input.
     *
     * @example
     * ```ts
     * const liveInput = await client.stream.liveInputs.update(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(liveInputIdentifier, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists the live inputs created for an account. To get the credentials needed to
     * stream to a specific live input, request a single live input.
     *
     * @example
     * ```ts
     * const liveInputs = await client.stream.liveInputs.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/stream/live_inputs`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Prevents a live input from being streamed to and makes the live input
     * inaccessible to any future API calls.
     *
     * @example
     * ```ts
     * await client.stream.liveInputs.delete(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(liveInputIdentifier, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    /**
     * Retrieves details of an existing live input.
     *
     * @example
     * ```ts
     * const liveInput = await client.stream.liveInputs.get(
     *   '66be4bf738797e01e1fca35a7bdecdcd',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(liveInputIdentifier, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/stream/live_inputs/${liveInputIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.LiveInputs = LiveInputs;
LiveInputs.Outputs = outputs_1.Outputs;
LiveInputs.OutputsSinglePage = outputs_1.OutputsSinglePage;
//# sourceMappingURL=live-inputs.js.map