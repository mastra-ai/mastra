"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailRoutingRulesV4PagePaginationArray = exports.Rules = void 0;
const resource_1 = require("../../../resource.js");
const CatchAllsAPI = __importStar(require("./catch-alls.js"));
const catch_alls_1 = require("./catch-alls.js");
const pagination_1 = require("../../../pagination.js");
class Rules extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.catchAlls = new CatchAllsAPI.CatchAlls(this._client);
    }
    /**
     * Rules consist of a set of criteria for matching emails (such as an email being
     * sent to a specific custom email address) plus a set of actions to take on the
     * email (like forwarding it to a specific destination address).
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.create({
     *     zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *     actions: [{ type: 'forward' }],
     *     matchers: [{ type: 'literal' }],
     *   });
     * ```
     */
    create(params, options) {
        const { zone_id, ...body } = params;
        return this._client.post(`/zones/${zone_id}/email/routing/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update actions and matches, or enable/disable specific routing rules.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.update(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     {
     *       zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *       actions: [{ type: 'forward' }],
     *       matchers: [{ type: 'literal' }],
     *     },
     *   );
     * ```
     */
    update(ruleIdentifier, params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/email/routing/rules/${ruleIdentifier}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists existing routing rules.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const emailRoutingRule of client.emailRouting.rules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id, ...query } = params;
        return this._client.getAPIList(`/zones/${zone_id}/email/routing/rules`, EmailRoutingRulesV4PagePaginationArray, { query, ...options });
    }
    /**
     * Delete a specific routing rule.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.delete(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    delete(ruleIdentifier, params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/email/routing/rules/${ruleIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get information for a specific routing rule already created.
     *
     * @example
     * ```ts
     * const emailRoutingRule =
     *   await client.emailRouting.rules.get(
     *     'a7e6fb77503c41d8a7f3113c6918f10c',
     *     { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(ruleIdentifier, params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/email/routing/rules/${ruleIdentifier}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Rules = Rules;
class EmailRoutingRulesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.EmailRoutingRulesV4PagePaginationArray = EmailRoutingRulesV4PagePaginationArray;
Rules.EmailRoutingRulesV4PagePaginationArray = EmailRoutingRulesV4PagePaginationArray;
Rules.CatchAlls = catch_alls_1.CatchAlls;
//# sourceMappingURL=rules.js.map