"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UARuleListResponsesV4PagePaginationArray = exports.UARules = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class UARules extends resource_1.APIResource {
    /**
     * Creates a new User Agent Blocking rule in a zone.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.create({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   configuration: {},
     *   mode: 'challenge',
     * });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/firewall/ua_rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates an existing User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.update(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   {
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     configuration: {},
     *     mode: 'challenge',
     *   },
     * );
     * ```
     */
    update(uaRuleId, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/firewall/ua_rules/${uaRuleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches User Agent Blocking rules in a zone. You can filter the results using
     * several optional parameters.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const uaRuleListResponse of client.firewall.uaRules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/firewall/ua_rules`, UARuleListResponsesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Deletes an existing User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.delete(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(uaRuleId, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/firewall/ua_rules/${uaRuleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the details of a User Agent Blocking rule.
     *
     * @example
     * ```ts
     * const uaRule = await client.firewall.uaRules.get(
     *   '372e67954025e0ba6aaa6d586b9e0b59',
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    get(uaRuleId, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/firewall/ua_rules/${uaRuleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.UARules = UARules;
class UARuleListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.UARuleListResponsesV4PagePaginationArray = UARuleListResponsesV4PagePaginationArray;
UARules.UARuleListResponsesV4PagePaginationArray = UARuleListResponsesV4PagePaginationArray;
//# sourceMappingURL=ua-rules.js.map