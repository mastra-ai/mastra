// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as ACLsAPI from "./acls.mjs";
import { ACLs, ACLsSinglePage, } from "./acls.mjs";
import * as LANsAPI from "./lans.mjs";
import { LANs, LANsSinglePage, } from "./lans.mjs";
import * as WANsAPI from "./wans.mjs";
import { WANs, WANsSinglePage, } from "./wans.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Sites extends APIResource {
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
export class SitesSinglePage extends SinglePage {
}
Sites.SitesSinglePage = SitesSinglePage;
Sites.ACLs = ACLs;
Sites.ACLsSinglePage = ACLsSinglePage;
Sites.LANs = LANs;
Sites.LANsSinglePage = LANsSinglePage;
Sites.WANs = WANs;
Sites.WANsSinglePage = WANsSinglePage;
//# sourceMappingURL=sites.mjs.map