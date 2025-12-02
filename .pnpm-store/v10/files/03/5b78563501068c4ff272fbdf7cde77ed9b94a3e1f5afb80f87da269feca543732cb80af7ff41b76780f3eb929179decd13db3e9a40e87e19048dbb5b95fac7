"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.RuleListResponsesSinglePage = exports.RuleUpdateResponsesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Rules extends resource_1.APIResource {
    /**
     * Put Rules
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleUpdateResponse of client.snippets.rules.update(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    update(params, options) {
        const { zone_id, ...body } = params;
        return this._client.getAPIList(`/zones/${zone_id}/snippets/snippet_rules`, RuleUpdateResponsesSinglePage, { body, method: 'put', ...options });
    }
    /**
     * Rules
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const ruleListResponse of client.snippets.rules.list(
     *   { zone_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { zone_id } = params;
        return this._client.getAPIList(`/zones/${zone_id}/snippets/snippet_rules`, RuleListResponsesSinglePage, options);
    }
    /**
     * Delete All Rules
     *
     * @example
     * ```ts
     * const rule = await client.snippets.rules.delete({
     *   zone_id: '023e105f4ecef8ad9ca31a8372d0c353',
     * });
     * ```
     */
    delete(params, options) {
        const { zone_id } = params;
        return this._client.delete(`/zones/${zone_id}/snippets/snippet_rules`, options);
    }
}
exports.Rules = Rules;
class RuleUpdateResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
class RuleListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
Rules.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=rules.js.map