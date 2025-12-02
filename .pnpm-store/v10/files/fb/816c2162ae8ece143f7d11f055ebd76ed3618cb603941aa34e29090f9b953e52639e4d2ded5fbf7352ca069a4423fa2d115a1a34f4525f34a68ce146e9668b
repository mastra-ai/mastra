"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ZeroTrustGroupsSinglePage = exports.GroupListResponsesSinglePage = exports.Groups = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const error_1 = require("../../../error.js");
const pagination_1 = require("../../../pagination.js");
class Groups extends resource_1.APIResource {
    /**
     * Creates a new Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.create({
     *   include: [
     *     {
     *       group: { id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f' },
     *     },
     *   ],
     *   name: 'Allow devs',
     *   account_id: 'account_id',
     * });
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/access/groups`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Access group.
     *
     * @example
     * ```ts
     * const group = await client.zeroTrust.access.groups.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   {
     *     include: [
     *       {
     *         group: {
     *           id: 'aa0a4aab-672b-4bdb-bc33-a59f1130a11f',
     *         },
     *       },
     *     ],
     *     name: 'Allow devs',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    update(groupId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/access/groups/${groupId}`, {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/access/groups`, GroupListResponsesSinglePage, { query, ...options });
    }
    delete(groupId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(groupId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/access/groups/${groupId}`, options)._thenUnwrap((obj) => obj.result);
    }
    get(groupId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(groupId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/access/groups/${groupId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Groups = Groups;
class GroupListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.GroupListResponsesSinglePage = GroupListResponsesSinglePage;
class ZeroTrustGroupsSinglePage extends pagination_1.SinglePage {
}
exports.ZeroTrustGroupsSinglePage = ZeroTrustGroupsSinglePage;
Groups.GroupListResponsesSinglePage = GroupListResponsesSinglePage;
//# sourceMappingURL=groups.js.map