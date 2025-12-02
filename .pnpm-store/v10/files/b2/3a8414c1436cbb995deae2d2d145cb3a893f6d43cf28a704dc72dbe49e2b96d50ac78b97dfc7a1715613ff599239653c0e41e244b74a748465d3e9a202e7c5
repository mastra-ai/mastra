// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as CAsAPI from "./cas.mjs";
import { CAs, CAsSinglePage, } from "./cas.mjs";
import * as ApplicationsPoliciesAPI from "./policies.mjs";
import { Policies, PolicyListResponsesSinglePage, } from "./policies.mjs";
import * as SettingsAPI from "./settings.mjs";
import { Settings, } from "./settings.mjs";
import * as UserPolicyChecksAPI from "./user-policy-checks.mjs";
import { UserPolicyChecks, } from "./user-policy-checks.mjs";
import * as PolicyTestsAPI from "./policy-tests/policy-tests.mjs";
import { PolicyTests, } from "./policy-tests/policy-tests.mjs";
import { CloudflareError } from "../../../../error.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Applications extends APIResource {
    constructor() {
        super(...arguments);
        this.cas = new CAsAPI.CAs(this._client);
        this.userPolicyChecks = new UserPolicyChecksAPI.UserPolicyChecks(this._client);
        this.policies = new ApplicationsPoliciesAPI.Policies(this._client);
        this.policyTests = new PolicyTestsAPI.PolicyTests(this._client);
        this.settings = new SettingsAPI.Settings(this._client);
    }
    /**
     * Adds a new application to Access.
     *
     * @example
     * ```ts
     * const application =
     *   await client.zeroTrust.access.applications.create({
     *     domain: 'test.example.com/admin',
     *     type: 'self_hosted',
     *     account_id: 'account_id',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/apps`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an Access application.
     *
     * @example
     * ```ts
     * const application =
     *   await client.zeroTrust.access.applications.update(
     *     '023e105f4ecef8ad9ca31a8372d0c353',
     *     {
     *       domain: 'test.example.com/admin',
     *       type: 'self_hosted',
     *       account_id: 'account_id',
     *     },
     *   );
     * ```
     */
    update(appId, params, options) {
        const { account_id, zone_id, ...body } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/apps`, ApplicationListResponsesSinglePage, { query, ...options });
    }
    delete(appId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(appId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}`, options)._thenUnwrap((obj) => obj.result);
    }
    revokeTokens(appId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.revokeTokens(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new CloudflareError('You cannot provide both account_id and zone_id.');
        }
        const { accountOrZone, accountOrZoneId } = account_id ?
            {
                accountOrZone: 'accounts',
                accountOrZoneId: account_id,
            }
            : {
                accountOrZone: 'zones',
                accountOrZoneId: zone_id,
            };
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/revoke_tokens`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ApplicationListResponsesSinglePage extends SinglePage {
}
Applications.ApplicationListResponsesSinglePage = ApplicationListResponsesSinglePage;
Applications.CAs = CAs;
Applications.CAsSinglePage = CAsSinglePage;
Applications.UserPolicyChecks = UserPolicyChecks;
Applications.Policies = Policies;
Applications.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
Applications.PolicyTests = PolicyTests;
Applications.Settings = Settings;
//# sourceMappingURL=applications.mjs.map