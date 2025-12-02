// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as ConnectionsAPI from "./connections.mjs";
import { Connections, ConnectionsSinglePage, } from "./connections.mjs";
import * as CookiesAPI from "./cookies.mjs";
import { CookieListResponsesSinglePage, Cookies, } from "./cookies.mjs";
import * as PoliciesAPI from "./policies.mjs";
import { Policies, PolicyListResponsesSinglePage, } from "./policies.mjs";
import * as ScriptsAPI from "./scripts.mjs";
import { Scripts, ScriptsSinglePage, } from "./scripts.mjs";
export class PageShield extends APIResource {
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
PageShield.Policies = Policies;
PageShield.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
PageShield.Connections = Connections;
PageShield.ConnectionsSinglePage = ConnectionsSinglePage;
PageShield.Scripts = Scripts;
PageShield.ScriptsSinglePage = ScriptsSinglePage;
PageShield.Cookies = Cookies;
PageShield.CookieListResponsesSinglePage = CookieListResponsesSinglePage;
//# sourceMappingURL=page-shield.mjs.map