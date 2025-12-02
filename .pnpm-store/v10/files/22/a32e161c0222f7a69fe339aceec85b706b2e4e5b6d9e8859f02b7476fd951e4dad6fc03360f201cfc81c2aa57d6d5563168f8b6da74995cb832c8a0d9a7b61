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
exports.ApplicationListResponsesSinglePage = exports.Applications = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const CAsAPI = __importStar(require("./cas.js"));
const cas_1 = require("./cas.js");
const ApplicationsPoliciesAPI = __importStar(require("./policies.js"));
const policies_1 = require("./policies.js");
const SettingsAPI = __importStar(require("./settings.js"));
const settings_1 = require("./settings.js");
const UserPolicyChecksAPI = __importStar(require("./user-policy-checks.js"));
const user_policy_checks_1 = require("./user-policy-checks.js");
const PolicyTestsAPI = __importStar(require("./policy-tests/policy-tests.js"));
const policy_tests_1 = require("./policy-tests/policy-tests.js");
const error_1 = require("../../../../error.js");
const pagination_1 = require("../../../../pagination.js");
class Applications extends resource_1.APIResource {
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
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
        }
        const { account_id, zone_id, ...query } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
        if ((0, core_1.isRequestOptions)(params)) {
            return this.revokeTokens(appId, {}, params);
        }
        const { account_id, zone_id } = params;
        if (!account_id && !zone_id) {
            throw new error_1.CloudflareError('You must provide either account_id or zone_id.');
        }
        if (account_id && zone_id) {
            throw new error_1.CloudflareError('You cannot provide both account_id and zone_id.');
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
exports.Applications = Applications;
class ApplicationListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.ApplicationListResponsesSinglePage = ApplicationListResponsesSinglePage;
Applications.ApplicationListResponsesSinglePage = ApplicationListResponsesSinglePage;
Applications.CAs = cas_1.CAs;
Applications.CAsSinglePage = cas_1.CAsSinglePage;
Applications.UserPolicyChecks = user_policy_checks_1.UserPolicyChecks;
Applications.Policies = policies_1.Policies;
Applications.PolicyListResponsesSinglePage = policies_1.PolicyListResponsesSinglePage;
Applications.PolicyTests = policy_tests_1.PolicyTests;
Applications.Settings = settings_1.Settings;
//# sourceMappingURL=applications.js.map