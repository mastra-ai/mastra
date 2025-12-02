// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as CertificatesAPI from "./certificates.mjs";
import { Certificates } from "./certificates.mjs";
import * as ExcludesAPI from "./excludes.mjs";
import { Excludes } from "./excludes.mjs";
import * as FallbackDomainsAPI from "./fallback-domains.mjs";
import { FallbackDomains } from "./fallback-domains.mjs";
import * as IncludesAPI from "./includes.mjs";
import { Includes } from "./includes.mjs";
export class Default extends APIResource {
    constructor() {
        super(...arguments);
        this.excludes = new ExcludesAPI.Excludes(this._client);
        this.includes = new IncludesAPI.Includes(this._client);
        this.fallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);
        this.certificates = new CertificatesAPI.Certificates(this._client);
    }
    /**
     * Updates the default device settings profile for an account.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.policies.default.edit({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    edit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/policy`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the default device settings profile for an account.
     *
     * @example
     * ```ts
     * const _default =
     *   await client.zeroTrust.devices.policies.default.get({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *   });
     * ```
     */
    get(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/policy`, options)._thenUnwrap((obj) => obj.result);
    }
}
Default.Excludes = Excludes;
Default.Includes = Includes;
Default.FallbackDomains = FallbackDomains;
Default.Certificates = Certificates;
//# sourceMappingURL=default.mjs.map