// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import { CloudflareError } from "../../../error.mjs";
export class Fields extends APIResource {
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/logpush/datasets/${datasetId}/fields`, options)._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=fields.mjs.map