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
exports.PageShield = void 0;
const resource_1 = require("../../resource.js");
const ConnectionsAPI = __importStar(require("./connections.js"));
const connections_1 = require("./connections.js");
const CookiesAPI = __importStar(require("./cookies.js"));
const cookies_1 = require("./cookies.js");
const PoliciesAPI = __importStar(require("./policies.js"));
const policies_1 = require("./policies.js");
const ScriptsAPI = __importStar(require("./scripts.js"));
const scripts_1 = require("./scripts.js");
class PageShield extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.policies = new PoliciesAPI.Policies(this._client);
        this.connections = new ConnectionsAPI.Connections(this._client);
        this.scripts = new ScriptsAPI.Scripts(this._client);
        this.cookies = new CookiesAPI.Cookies(this._client);
    }
    /**
     * Updates Page Shield settings.
     *
     * @example
     * ```ts
     * const pageShield = await client.pageShield.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/page_shield`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the Page Shield settings.
     *
     * @example
     * ```ts
     * const setting = await client.pageShield.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/page_shield`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.PageShield = PageShield;
PageShield.Policies = policies_1.Policies;
PageShield.PolicyListResponsesSinglePage = policies_1.PolicyListResponsesSinglePage;
PageShield.Connections = connections_1.Connections;
PageShield.ConnectionsSinglePage = connections_1.ConnectionsSinglePage;
PageShield.Scripts = scripts_1.Scripts;
PageShield.ScriptsSinglePage = scripts_1.ScriptsSinglePage;
PageShield.Cookies = cookies_1.Cookies;
PageShield.CookieListResponsesSinglePage = cookies_1.CookieListResponsesSinglePage;
//# sourceMappingURL=page-shield.js.map