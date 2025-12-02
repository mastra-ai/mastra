// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { CloudflareError } from "../../../error.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Versions extends APIResource {
    list(rulesetPhase, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.list(rulesetPhase, {}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint/versions`, VersionListResponsesSinglePage, options);
    }
    get(rulesetPhase, rulesetVersion, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(rulesetPhase, rulesetVersion, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/phases/${rulesetPhase}/entrypoint/versions/${rulesetVersion}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class VersionListResponsesSinglePage extends SinglePage {
}
Versions.VersionListResponsesSinglePage = VersionListResponsesSinglePage;
//# sourceMappingURL=versions.mjs.map