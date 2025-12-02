"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.GatewayRulesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../../resource.js");
const pagination_1 = require("../../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Creates a new Zero Trust Gateway rule.
     *
     * @example
     * ```ts
     * const gatewayRule =
     *   await client.zeroTrust.gateway.rules.create({
     *     account_id: '699d98642c564d2e855e9661899b7252',
     *     action: 'allow',
     *     name: 'block bad websites',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/gateway/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a configured Zero Trust Gateway rule.
     *
     * @example
     * ```ts
     * const gatewayRule =
     *   await client.zeroTrust.gateway.rules.update(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     {
     *       account_id: '699d98642c564d2e855e9661899b7252',
     *       action: 'allow',
     *       name: 'block bad websites',
     *     },
     *   );
     * ```
     */
    update(ruleId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/gateway/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the Zero Trust Gateway rules for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const gatewayRule of client.zeroTrust.gateway.rules.list(
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/gateway/rules`, GatewayRulesSinglePage, options);
    }
    /**
     * Deletes a Zero Trust Gateway rule.
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.gateway.rules.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '699d98642c564d2e855e9661899b7252' },
     * );
     * ```
     */
    delete(ruleId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/gateway/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single Zero Trust Gateway rule.
     *
     * @example
     * ```ts
     * const gatewayRule =
     *   await client.zeroTrust.gateway.rules.get(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    get(ruleId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/gateway/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Resets the expiration of a Zero Trust Gateway Rule if its duration has elapsed
     * and it has a default duration.
     *
     * The Zero Trust Gateway Rule must have values for both `expiration.expires_at`
     * and `expiration.duration`.
     *
     * @example
     * ```ts
     * const gatewayRule =
     *   await client.zeroTrust.gateway.rules.resetExpiration(
     *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     { account_id: '699d98642c564d2e855e9661899b7252' },
     *   );
     * ```
     */
    resetExpiration(ruleId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/gateway/rules/${ruleId}/reset_expiration`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Rules = Rules;
class GatewayRulesSinglePage extends pagination_1.SinglePage {
}
exports.GatewayRulesSinglePage = GatewayRulesSinglePage;
Rules.GatewayRulesSinglePage = GatewayRulesSinglePage;
//# sourceMappingURL=rules.js.map