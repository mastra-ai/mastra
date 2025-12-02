"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Severity = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const error_1 = require("../../../error.js");
class Severity extends resource_1.APIResource {
    get(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get({}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/security-center/insights/severity`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Severity = Severity;
//# sourceMappingURL=severity.js.map