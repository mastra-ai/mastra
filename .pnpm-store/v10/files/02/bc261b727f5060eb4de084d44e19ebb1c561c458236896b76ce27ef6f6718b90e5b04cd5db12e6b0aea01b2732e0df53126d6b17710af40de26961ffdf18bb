"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirewallFiltersV4PagePaginationArray = exports.FirewallFiltersSinglePage = exports.Filters = void 0;
const resource_1 = require("../resource.js");
const pagination_1 = require("../pagination.js");
/**
 * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
 */
class Filters extends resource_1.APIResource {
    /**
     * Creates one or more filters.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
            body,
            method: 'post',
            ...options,
        });
    }
    /**
     * Updates an existing filter.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    update(filterId, params, options) {
        const { zone_id, body } = params;
        return this._client.put(`/zones/${zone_id}/filters/${filterId}`, {
            body: body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches filters in a zone. You can filter the results using several optional
     * parameters.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes an existing filter.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    delete(filterId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/filters/${filterId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes one or more existing filters.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkDelete(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
            method: 'delete',
            ...options,
        });
    }
    /**
     * Updates one or more existing filters.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    bulkUpdate(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/filters`, FirewallFiltersSinglePage, {
            body,
            method: 'put',
            ...options,
        });
    }
    /**
     * Fetches the details of a filter.
     *
     * @deprecated The Filters API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#firewall-rules-api-and-filters-api for full details.
     */
    get(filterId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/filters/${filterId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Filters = Filters;
class FirewallFiltersSinglePage extends pagination_1.SinglePage {
}
exports.FirewallFiltersSinglePage = FirewallFiltersSinglePage;
class FirewallFiltersV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.FirewallFiltersV4PagePaginationArray = FirewallFiltersV4PagePaginationArray;
Filters.FirewallFiltersSinglePage = FirewallFiltersSinglePage;
Filters.FirewallFiltersV4PagePaginationArray = FirewallFiltersV4PagePaginationArray;
//# sourceMappingURL=filters.js.map