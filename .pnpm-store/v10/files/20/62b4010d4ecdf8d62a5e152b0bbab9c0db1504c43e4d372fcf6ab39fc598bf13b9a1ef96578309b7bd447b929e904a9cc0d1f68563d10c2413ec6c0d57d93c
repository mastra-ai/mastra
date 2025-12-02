// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as ClassAPI from "./class.mjs";
import { Class } from "./class.mjs";
import * as SeverityAPI from "./severity.mjs";
import { Severity } from "./severity.mjs";
import * as TypeAPI from "./type.mjs";
import { Type } from "./type.mjs";
import { CloudflareError } from "../../../error.mjs";
import { V4PagePagination } from "../../../pagination.mjs";
export class Insights extends APIResource {
    constructor() {
        super(...arguments);
        this.class = new ClassAPI.Class(this._client);
        this.severity = new SeverityAPI.Severity(this._client);
        this.type = new TypeAPI.Type(this._client);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/security-center/insights`, InsightListResponsesV4PagePagination, { query, ...options });
    }
    /**
     * Archive Security Center Insight
     */
    dismiss(issueId, params, options) {
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/security-center/insights/${issueId}/dismiss`, { body, ...options });
    }
}
export class InsightListResponsesV4PagePagination extends V4PagePagination {
}
Insights.InsightListResponsesV4PagePagination = InsightListResponsesV4PagePagination;
Insights.Class = Class;
Insights.Severity = Severity;
Insights.Type = Type;
//# sourceMappingURL=insights.mjs.map