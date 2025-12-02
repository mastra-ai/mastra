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
exports.Configs = void 0;
const resource_1 = require("../../../resource.js");
const FullAPI = __importStar(require("./full.js"));
const full_1 = require("./full.js");
class Configs extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.full = new FullAPI.Full(this._client);
    }
    /**
     * Create a new network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.create({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     default_sampling: 1,
     *     name: "cloudflare user's account",
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an existing network monitoring configuration, requires the entire
     * configuration to be updated at once.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.update({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     default_sampling: 1,
     *     name: "cloudflare user's account",
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Delete an existing network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.delete({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    delete(params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/mnm/config`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update fields in an existing network monitoring configuration.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.edit({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/mnm/config`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists default sampling, router IPs and warp devices for account.
     *
     * @example
     * ```ts
     * const configuration =
     *   await client.magicNetworkMonitoring.configs.get({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mnm/config`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Configs = Configs;
Configs.Full = full_1.Full;
//# sourceMappingURL=configs.js.map