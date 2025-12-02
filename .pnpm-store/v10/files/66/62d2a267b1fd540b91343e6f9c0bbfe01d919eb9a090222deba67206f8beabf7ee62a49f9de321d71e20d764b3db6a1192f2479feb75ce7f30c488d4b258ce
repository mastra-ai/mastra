"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fields = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const error_1 = require("../../../error.js");
class Fields extends resource_1.APIResource {
    get(datasetId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(datasetId, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/logpush/datasets/${datasetId}/fields`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Fields = Fields;
//# sourceMappingURL=fields.js.map