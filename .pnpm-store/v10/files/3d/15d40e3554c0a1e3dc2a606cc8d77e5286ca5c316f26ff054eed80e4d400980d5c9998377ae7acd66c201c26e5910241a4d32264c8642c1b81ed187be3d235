"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RateLimitsV4PagePaginationArray = exports.RateLimits = void 0;
const resource_1 = require("../resource.js");
const pagination_1 = require("../pagination.js");
/**
 * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
 */
class RateLimits extends resource_1.APIResource {
    /**
     * Creates a new rate limit for a zone. Refer to the object definition for a list
     * of required attributes.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/rate_limits`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the rate limits for a zone.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/rate_limits`, RateLimitsV4PagePaginationArray, {
            query,
            ...options,
        });
    }
    /**
     * Deletes an existing rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    delete(rateLimitId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/rate_limits/${rateLimitId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    edit(rateLimitId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/rate_limits/${rateLimitId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a rate limit.
     *
     * @deprecated Rate limiting API is deprecated in favour of using the Ruleset Engine. See https://developers.cloudflare.com/fundamentals/api/reference/deprecations/#rate-limiting-api-previous-version for full details.
     */
    get(rateLimitId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/rate_limits/${rateLimitId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.RateLimits = RateLimits;
class RateLimitsV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.RateLimitsV4PagePaginationArray = RateLimitsV4PagePaginationArray;
RateLimits.RateLimitsV4PagePaginationArray = RateLimitsV4PagePaginationArray;
//# sourceMappingURL=rate-limits.js.map