"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomPageListResponsesSinglePage = exports.CustomPages = void 0;
const resource_1 = require("../resource.js");
const core_1 = require("../core.js");
const error_1 = require("../error.js");
const pagination_1 = require("../pagination.js");
class CustomPages extends resource_1.APIResource {
    /**
     * Updates the configuration of an existing custom page.
     *
     * @example
     * ```ts
     * const customPage = await client.customPages.update(
     *   '023e105f4ecef8ad9ca31a8372d0c353',
     *   {
     *     state: 'default',
     *     url: 'http://www.example.com',
     *     account_id: 'account_id',
     *   },
     * );
     * ```
     */
    update(identifier, params, options) {
        const { account_id, zone_id, ...body } = params;
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
        return this._client.put(`/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    list(params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.list({}, params);
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
        return this._client.getAPIList(`/${accountOrZone}/${accountOrZoneId}/custom_pages`, CustomPageListResponsesSinglePage, options);
    }
    get(identifier, params = {}, options) {
        if ((0, core_1.isRequestOptions)(params)) {
            return this.get(identifier, {}, params);
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
        return this._client.get(`/${accountOrZone}/${accountOrZoneId}/custom_pages/${identifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.CustomPages = CustomPages;
class CustomPageListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CustomPageListResponsesSinglePage = CustomPageListResponsesSinglePage;
CustomPages.CustomPageListResponsesSinglePage = CustomPageListResponsesSinglePage;
//# sourceMappingURL=custom-pages.js.map