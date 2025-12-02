// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Rules extends APIResource {
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
export class RuleUpdateResponsesSinglePage extends SinglePage {
}
export class RuleListResponsesSinglePage extends SinglePage {
}
Rules.RuleUpdateResponsesSinglePage = RuleUpdateResponsesSinglePage;
Rules.RuleListResponsesSinglePage = RuleListResponsesSinglePage;
//# sourceMappingURL=rules.mjs.map