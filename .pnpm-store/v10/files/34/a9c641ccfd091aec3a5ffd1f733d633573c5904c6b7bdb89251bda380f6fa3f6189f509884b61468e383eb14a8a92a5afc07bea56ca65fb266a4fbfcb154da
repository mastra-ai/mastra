// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import { SettingsPoliciesSinglePage } from "../policies.mjs";
import * as ExcludesAPI from "./excludes.mjs";
import { Excludes } from "./excludes.mjs";
import * as FallbackDomainsAPI from "./fallback-domains.mjs";
import { FallbackDomains } from "./fallback-domains.mjs";
import * as IncludesAPI from "./includes.mjs";
import { Includes } from "./includes.mjs";
export class Custom extends APIResource {
    constructor() {
        super(...arguments);
        this.excludes = new ExcludesAPI.Excludes(this._client);
        this.includes = new IncludesAPI.Includes(this._client);
        this.fallbackDomains = new FallbackDomainsAPI.FallbackDomains(this._client);
    }
    /**
     * Creates a device settings profile to be applied to certain devices matching the
     * criteria.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     match: 'identity.email == "test@cloudflare.com"',
     *     name: 'Allow Developers',
     *     precedence: 100,
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/devices/policy`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a list of the device settings profiles for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policies`, SettingsPoliciesSinglePage, options);
    }
    /**
     * Deletes a device settings profile and fetches a list of the remaining profiles
     * for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const settingsPolicy of client.zeroTrust.devices.policies.custom.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    delete(policyId, params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/policy/${policyId}`, SettingsPoliciesSinglePage, { method: 'delete', ...options });
    }
    /**
     * Updates a configured device settings profile.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.edit(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    edit(policyId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/devices/policy/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a device settings profile by ID.
     *
     * @example
     * ```ts
     * const settingsPolicy =
     *   await client.zeroTrust.devices.policies.custom.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(policyId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/policy/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
Custom.Excludes = Excludes;
Custom.Includes = Includes;
Custom.FallbackDomains = FallbackDomains;
export { SettingsPoliciesSinglePage };
//# sourceMappingURL=custom.mjs.map