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
exports.SitesSinglePage = exports.Sites = void 0;
const resource_1 = require("../../../resource.js");
const ACLsAPI = __importStar(require("./acls.js"));
const acls_1 = require("./acls.js");
const LANsAPI = __importStar(require("./lans.js"));
const lans_1 = require("./lans.js");
const WANsAPI = __importStar(require("./wans.js"));
const wans_1 = require("./wans.js");
const pagination_1 = require("../../../pagination.js");
class Sites extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.acls = new ACLsAPI.ACLs(this._client);
        this.lans = new LANsAPI.LANs(this._client);
        this.wans = new WANsAPI.WANs(this._client);
    }
    /**
     * Creates a new Site
     *
     * @example
     * ```ts
     * const site = await client.magicTransit.sites.create({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   name: 'site_1',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/sites`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a specific Site.
     *
     * @example
     * ```ts
     * const site = await client.magicTransit.sites.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/sites/${siteId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists Sites associated with an account. Use connectorid query param to return
     * sites where connectorid matches either site.ConnectorID or
     * site.SecondaryConnectorID.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const site of client.magicTransit.sites.list({
     *   account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/sites`, SitesSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Remove a specific Site.
     *
     * @example
     * ```ts
     * const site = await client.magicTransit.sites.delete(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(siteId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/sites/${siteId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Patch a specific Site.
     *
     * @example
     * ```ts
     * const site = await client.magicTransit.sites.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    edit(siteId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/sites/${siteId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get a specific Site.
     *
     * @example
     * ```ts
     * const site = await client.magicTransit.sites.get(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(siteId, params, options) {
        const { account_id, 'x-magic-new-hc-target': xMagicNewHcTarget } = params;
        return this._client.get(`/accounts/${account_id}/magic/sites/${siteId}`, {
            ...options,
            headers: {
                ...(xMagicNewHcTarget?.toString() != null ?
                    { 'x-magic-new-hc-target': xMagicNewHcTarget?.toString() }
                    : undefined),
                ...options?.headers,
            },
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Sites = Sites;
class SitesSinglePage extends pagination_1.SinglePage {
}
exports.SitesSinglePage = SitesSinglePage;
Sites.SitesSinglePage = SitesSinglePage;
Sites.ACLs = acls_1.ACLs;
Sites.ACLsSinglePage = acls_1.ACLsSinglePage;
Sites.LANs = lans_1.LANs;
Sites.LANsSinglePage = lans_1.LANsSinglePage;
Sites.WANs = wans_1.WANs;
Sites.WANsSinglePage = wans_1.WANsSinglePage;
//# sourceMappingURL=sites.js.map