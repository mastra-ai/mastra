// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { isRequestOptions } from "../../core.mjs";
import * as RulesAPI from "./rules.mjs";
import { Rules, } from "./rules.mjs";
import * as VersionsAPI from "./versions.mjs";
import { VersionListResponsesSinglePage, Versions, } from "./versions.mjs";
import * as PhasesAPI from "./phases/phases.mjs";
import { Phases, } from "./phases/phases.mjs";
import { CloudflareError } from "../../error.mjs";
import { CursorPagination } from "../../pagination.mjs";
export class Rulesets extends APIResource {
    constructor() {
        super(...arguments);
        this.phases = new PhasesAPI.Phases(this._client);
        this.rules = new RulesAPI.Rules(this._client);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Creates a ruleset.
     *
     * @example
     * ```ts
     * const ruleset = await client.rulesets.create({
     *   kind: 'root',
     *   name: 'My ruleset',
     *   phase: 'http_request_firewall_custom',
     *   account_id: 'account_id',
     * });
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
        return this._client.post(`/${accountOrZone}/${accountOrZoneId}/rulesets`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an account or zone ruleset, creating a new version.
     *
     * @example
     * ```ts
     * const ruleset = await client.rulesets.update(
     *   '2f2feab2026849078ba485f918791bdc',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    update(rulesetId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/rulesets`, RulesetListResponsesCursorPagination, { query, ...options });
    }
    delete(rulesetId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.delete(rulesetId, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, {
            ...options,
            headers: { Accept: '*/*', ...options?.headers },
        });
    }
    get(rulesetId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(rulesetId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class RulesetListResponsesCursorPagination extends CursorPagination {
}
Rulesets.RulesetListResponsesCursorPagination = RulesetListResponsesCursorPagination;
Rulesets.Phases = Phases;
Rulesets.Rules = Rules;
Rulesets.Versions = Versions;
Rulesets.VersionListResponsesSinglePage = VersionListResponsesSinglePage;
//# sourceMappingURL=rulesets.mjs.map