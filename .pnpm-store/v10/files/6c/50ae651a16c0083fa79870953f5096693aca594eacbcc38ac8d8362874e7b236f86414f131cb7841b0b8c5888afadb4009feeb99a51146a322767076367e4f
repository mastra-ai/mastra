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
exports.NamespaceListResponsesSinglePage = exports.Namespaces = void 0;
const resource_1 = require("../../../../resource.js");
const ScriptsAPI = __importStar(require("./scripts/scripts.js"));
const scripts_1 = require("./scripts/scripts.js");
const pagination_1 = require("../../../../pagination.js");
class Namespaces extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.scripts = new ScriptsAPI.Scripts(this._client);
    }
    /**
     * Create a new Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.create(
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/workers/dispatch/namespaces`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetch a list of Workers for Platforms namespaces.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const namespaceListResponse of client.workersForPlatforms.dispatch.namespaces.list(
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/workers/dispatch/namespaces`, NamespaceListResponsesSinglePage, options);
    }
    /**
     * Delete a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.delete(
     *     'my-dispatch-namespace',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(dispatchNamespace, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a Workers for Platforms namespace.
     *
     * @example
     * ```ts
     * const namespace =
     *   await client.workersForPlatforms.dispatch.namespaces.get(
     *     'my-dispatch-namespace',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(dispatchNamespace, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/workers/dispatch/namespaces/${dispatchNamespace}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Namespaces = Namespaces;
class NamespaceListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.NamespaceListResponsesSinglePage = NamespaceListResponsesSinglePage;
Namespaces.NamespaceListResponsesSinglePage = NamespaceListResponsesSinglePage;
Namespaces.Scripts = scripts_1.Scripts;
//# sourceMappingURL=namespaces.js.map