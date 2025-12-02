"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogpushJobsSinglePage = exports.Jobs = void 0;
const resource_1 = require("../../../resource.js");
const core_1 = require("../../../core.js");
const jobs_1 = require("../jobs.js");
Object.defineProperty(exports, "LogpushJobsSinglePage", { enumerable: true, get: function () { return jobs_1.LogpushJobsSinglePage; } });
const error_1 = require("../../../error.js");
class Jobs extends resource_1.APIResource {
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/logpush/datasets/${datasetId}/jobs`, jobs_1.LogpushJobsSinglePage, options);
    }
}
exports.Jobs = Jobs;
//# sourceMappingURL=jobs.js.map