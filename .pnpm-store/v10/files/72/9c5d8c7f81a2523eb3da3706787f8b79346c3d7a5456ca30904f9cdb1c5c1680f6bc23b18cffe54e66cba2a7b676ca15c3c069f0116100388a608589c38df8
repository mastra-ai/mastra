"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.PolicyListResponsesSinglePage = exports.Policies = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
const error_1 = require("../../../../error.js");
const pagination_1 = require("../../../../pagination.js");
class Policies extends resource_1.APIResource {
    /**
     * Creates a policy applying exclusive to a single application that defines the
     * users or groups who can reach it. We recommend creating a reusable policy
     * instead and subsequently referencing its ID in the application's 'policies'
     * array.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.create(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    create(appId, params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/policies`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an Access policy specific to an application. To update a reusable
     * policy, use the /account or zones/{account or zone_id}/policies/{uid} endpoint.
     *
     * @example
     * ```ts
     * const policy =
     *   await client.zeroTrust.access.applications.policies.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    update(appId, policyId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/policies/${policyId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(appId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list(appId, {}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/policies`, PolicyListResponsesSinglePage, options);
    }
    delete(appId, policyId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(appId, policyId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(appId, policyId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(appId, policyId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/apps/${appId}/policies/${policyId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Policies = Policies;
class PolicyListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
Policies.PolicyListResponsesSinglePage = PolicyListResponsesSinglePage;
//# sourceMappingURL=policies.js.map