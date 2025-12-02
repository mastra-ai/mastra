"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbuseReports = void 0;
const resource_1 = require("../resource.js");
class AbuseReports extends resource_1.APIResource {
    /**
     * Submit the Abuse Report of a particular type
     *
     * @example
     * ```ts
     * const abuseReport = await client.abuseReports.create(
     *   'abuse_general',
     *   {
     *     account_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     act: 'abuse_general',
     *     email: 'email',
     *     email2: 'email2',
     *     name: 'x',
     *     urls: 'urls',
     *   },
     * );
     * ```
     */
    create(reportType, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/abuse-reports/${reportType}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.AbuseReports = AbuseReports;
//# sourceMappingURL=abuse-reports.js.map