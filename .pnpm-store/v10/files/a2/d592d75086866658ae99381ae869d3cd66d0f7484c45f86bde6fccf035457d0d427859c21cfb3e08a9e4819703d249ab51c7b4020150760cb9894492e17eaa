// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { LogpushJobsSinglePage } from "../jobs.mjs";
import { CloudflareError } from "../../../error.mjs";
export class Jobs extends APIResource {
    get(datasetId, params = {}, options) {
        if (isRequestOptions(params)) {
            return this.get(datasetId, {}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/logpush/datasets/${datasetId}/jobs`, LogpushJobsSinglePage, options);
    }
}
export { LogpushJobsSinglePage };
//# sourceMappingURL=jobs.mjs.map