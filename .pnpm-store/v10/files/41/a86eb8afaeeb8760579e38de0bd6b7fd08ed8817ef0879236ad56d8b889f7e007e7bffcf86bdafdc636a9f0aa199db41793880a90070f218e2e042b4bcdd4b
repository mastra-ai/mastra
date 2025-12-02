"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleListResponsesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../../../resource.js");
const pagination_1 = require("../../../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Create email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.create({
     *   account_id: 'account_id',
     *   action: { action: 'Block' },
     *   conditions: [
     *     {
     *       operator: 'InList',
     *       selector: 'Recipients',
     *       value: ['string'],
     *     },
     *   ],
     *   enabled: true,
     *   name: 'name',
     * });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/dlp/email/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.update(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   {
     *     account_id: 'account_id',
     *     action: { action: 'Block' },
     *     conditions: [
     *       {
     *         operator: 'InList',
     *         selector: 'Recipients',
     *         value: ['string'],
     *       },
     *     ],
     *     enabled: true,
     *     name: 'name',
     *   },
     * );
     * ```
     */
    update(ruleId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all email scanner rules for an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleListResponse of client.zeroTrust.dlp.email.rules.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/email/rules`, RuleListResponsesSinglePage, options);
    }
    /**
     * Delete email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.delete(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    delete(ruleId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update email scanner rule priorities
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.dlp.email.rules.bulkEdit({
     *     account_id: 'account_id',
     *     new_priorities: { foo: 0 },
     *   });
     * ```
     */
    bulkEdit(params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/dlp/email/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get an email scanner rule
     *
     * @example
     * ```ts
     * const rule = await client.zeroTrust.dlp.email.rules.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(ruleId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/email/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Rules = Rules;
class RuleListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=rules.js.map