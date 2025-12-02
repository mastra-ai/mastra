"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.VersionListResponsesSinglePage = exports.Versions = void 0;
const resource_1 = require("../../resource.js");
const core_1 = require("../../core.js");
const error_1 = require("../../error.js");
const pagination_1 = require("../../pagination.js");
class Versions extends resource_1.APIResource {
    list(rulesetId, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list(rulesetId, {}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions`, VersionListResponsesSinglePage, options);
    }
    delete(rulesetId, rulesetVersion, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.delete(rulesetId, rulesetVersion, {}, params);
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
        return this._client.delete(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions/${rulesetVersion}`, { ...options, headers: { Accept: '*/*', ...options?.headers } });
    }
    get(rulesetId, rulesetVersion, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(rulesetId, rulesetVersion, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/rulesets/${rulesetId}/versions/${rulesetVersion}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Versions = Versions;
class VersionListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.VersionListResponsesSinglePage = VersionListResponsesSinglePage;
Versions.VersionListResponsesSinglePage = VersionListResponsesSinglePage;
//# sourceMappingURL=versions.js.map