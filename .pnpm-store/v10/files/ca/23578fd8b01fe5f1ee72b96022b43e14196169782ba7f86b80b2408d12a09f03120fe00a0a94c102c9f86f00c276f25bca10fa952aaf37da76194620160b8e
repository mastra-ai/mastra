"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotManagement = void 0;
const resource_1 = require("../resource.js");
class BotManagement extends resource_1.APIResource {
    /**
     * Updates the Bot Management configuration for a zone.
     *
     * This API is used to update:
     *
     * - **Bot Fight Mode**
     * - **Super Bot Fight Mode**
     * - **Bot Management for Enterprise**
     *
     * See [Bot Plans](https://developers.cloudflare.com/bots/plans/) for more
     * information on the different plans \
     * If you recently upgraded or downgraded your plan, refer to the following examples
     * to clean up old configurations. Copy and paste the example body to remove old zone
     * configurations based on your current plan.
     *
     * #### Clean up configuration for Bot Fight Mode plan
     *
     * ```json
     * {
     *   "sbfm_likely_automated": "allow",
     *   "sbfm_definitely_automated": "allow",
     *   "sbfm_verified_bots": "allow",
     *   "sbfm_static_resource_protection": false,
     *   "optimize_wordpress": false,
     *   "suppress_session_score": false
     * }
     * ```
     *
     * #### Clean up configuration for SBFM Pro plan
     *
     * ```json
     * {
     *   "sbfm_likely_automated": "allow",
     *   "fight_mode": false
     * }
     * ```
     *
     * #### Clean up configuration for SBFM Biz plan
     *
     * ```json
     * {
     *   "fight_mode": false
     * }
     * ```
     *
     * #### Clean up configuration for BM Enterprise Subscription plan
     *
     * It is strongly recommended that you ensure you have
     * [custom rules](https://developers.cloudflare.com/waf/custom-rules/) in place to
     * protect your zone before disabling the SBFM rules. Without these protections,
     * your zone is vulnerable to attacks.
     *
     * ```json
     * {
     *   "sbfm_likely_automated": "allow",
     *   "sbfm_definitely_automated": "allow",
     *   "sbfm_verified_bots": "allow",
     *   "sbfm_static_resource_protection": false,
     *   "optimize_wordpress": false,
     *   "fight_mode": false
     * }
     * ```
     *
     * @example
     * ```ts
     * const botManagement = await client.botManagement.update({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     *   ai_bots_protection: 'disabled',
     *   crawler_protection: 'disabled',
     *   enable_js: true,
     *   fight_mode: true,
     * });
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.put(`/zones/${zone_id}/bot_management`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Retrieve a zone's Bot Management Config
     *
     * @example
     * ```ts
     * const botManagement = await client.botManagement.get({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    get(params, options) {
        const { zone_id } = params;
        return this._client.get(`/zones/${zone_id}/bot_management`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.BotManagement = BotManagement;
//# sourceMappingURL=bot-management.js.map