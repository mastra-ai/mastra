"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Rules = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const error_1 = require("../../error.js");
class Rules extends resource_1.APIResource {
    /**
     * Adds a new rule to an account or zone ruleset. The rule will be added to the end
     * of the existing list of rules in the ruleset by default.
     *
     * @example
     * ```ts
     * const rule = await client.rulesets.rules.create(
     *   '2f2feab2026849078ba485f918791bdc',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    create(rulesetId, params, options) {
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/rules`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    delete(rulesetId, ruleId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(rulesetId, ruleId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing rule in an account or zone ruleset.
     *
     * @example
     * ```ts
     * const response = await client.rulesets.rules.edit(
     *   '2f2feab2026849078ba485f918791bdc',
     *   '3a03d665bac047339bb530ecb439a90d',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    edit(rulesetId, ruleId, params, options) {
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
        return this._client.patch(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Rules = Rules;
//# sourceMappingURL=rules.js.map