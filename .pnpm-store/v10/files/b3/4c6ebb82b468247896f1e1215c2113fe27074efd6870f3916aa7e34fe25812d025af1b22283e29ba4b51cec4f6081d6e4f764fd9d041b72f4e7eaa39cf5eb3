// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as VersionsAPI from "./versions.mjs";
import { VersionListResponsesSinglePage, Versions, } from "./versions.mjs";
import { CloudflareError } from "../../../error.mjs";
export class Phases extends APIResource {
    constructor() {
        super(...arguments);
        this.versions = new VersionsAPI.Versions(this._client);
    }
    /**
     * Updates an account or zone entry point ruleset, creating a new version.
     *
     * @example
     * ```ts
     * const phase = await client.rulesets.phases.update(
     *   'http_request_firewall_custom',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    update(rulesetPhase, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    get(rulesetPhase, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(rulesetPhase, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint`, options)._thenUnwrap((obj) => obj.result);
    }
}
Phases.Versions = Versions;
Phases.VersionListResponsesSinglePage = VersionListResponsesSinglePage;
//# sourceMappingURL=phases.mjs.map