// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import { CloudflareError } from "../../error.mjs";
import { V4PagePaginationArray } from "../../pagination.mjs";
export class AccessRules extends APIResource {
    /**
     * Creates a new IP Access rule for an account or zone. The rule will apply to all
     * zones in the account or zone.
     *
     * Note: To create an IP Access rule that applies to a single zone, refer to the
     * [IP Access rules for a zone](#ip-access-rules-for-a-zone) endpoints.
     *
     * @example
     * ```ts
     * const accessRule = await client.firewall.accessRules.create(
     *   {
     *     configuration: {},
     *     mode: 'challenge',
     *     account_id: 'account_id',
     *   },
     * );
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/firewall/access_rules/rules`, {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/firewall/access_rules/rules`, AccessRuleListResponsesV4PagePaginationArray, { query, ...options });
    }
    delete(ruleId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(ruleId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/firewall/access_rules/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an IP Access rule defined.
     *
     * Note: This operation will affect all zones in the account or zone.
     *
     * @example
     * ```ts
     * const response = await client.firewall.accessRules.edit(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     configuration: {},
     *     mode: 'challenge',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    edit(ruleId, params, options) {
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
        return this._client.patch(`/${accountOrZone}/${accountOrZoneId}/firewall/access_rules/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    get(ruleId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(ruleId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/firewall/access_rules/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class AccessRuleListResponsesV4PagePaginationArray extends V4PagePaginationArray {
}
AccessRules.AccessRuleListResponsesV4PagePaginationArray = AccessRuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=access-rules.mjs.map