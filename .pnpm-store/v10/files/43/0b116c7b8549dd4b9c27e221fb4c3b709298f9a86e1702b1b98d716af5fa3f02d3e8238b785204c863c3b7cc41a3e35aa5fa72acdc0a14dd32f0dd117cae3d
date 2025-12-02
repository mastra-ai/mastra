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
exports.MonitorsSinglePage = exports.Monitors = void 0;
const resource_1 = require("../../../resource.js");
const PreviewsAPI = __importStar(require("./previews.js"));
const previews_1 = require("./previews.js");
const ReferencesAPI = __importStar(require("./references.js"));
const references_1 = require("./references.js");
const pagination_1 = require("../../../pagination.js");
class Monitors extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.previews = new PreviewsAPI.Previews(this._client);
        this.references = new ReferencesAPI.References(this._client);
    }
    /**
     * Create a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/load_balancers/monitors`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modify a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.update(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(monitorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List configured monitors for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const monitor of client.loadBalancers.monitors.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/load_balancers/monitors`, MonitorsSinglePage, options);
    }
    /**
     * Delete a configured monitor.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.delete(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(monitorId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Apply changes to an existing monitor, overwriting the supplied properties.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.edit(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(monitorId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List a single configured monitor for an account.
     *
     * @example
     * ```ts
     * const monitor = await client.loadBalancers.monitors.get(
     *   'f1aba936b94213e5b8dca0c0dbf1f9cc',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(monitorId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/load_balancers/monitors/${monitorId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Monitors = Monitors;
class MonitorsSinglePage extends pagination_1.SinglePage {
}
exports.MonitorsSinglePage = MonitorsSinglePage;
Monitors.MonitorsSinglePage = MonitorsSinglePage;
Monitors.Previews = previews_1.Previews;
Monitors.References = references_1.References;
Monitors.ReferenceGetResponsesSinglePage = references_1.ReferenceGetResponsesSinglePage;
//# sourceMappingURL=monitors.js.map