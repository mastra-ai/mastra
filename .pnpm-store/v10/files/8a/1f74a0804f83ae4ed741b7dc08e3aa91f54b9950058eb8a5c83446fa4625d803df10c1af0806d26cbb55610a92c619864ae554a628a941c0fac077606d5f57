// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
export class Rules extends APIResource {
    /**
     * Creates a new rule in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rumRule = await client.rum.rules.create(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    create(rulesetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/rum/v2/${rulesetId}/rule`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Updates a rule in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rumRule = await client.rum.rules.update(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    update(rulesetId, ruleId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/rum/v2/${rulesetId}/rule/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists all the rules in a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rules = await client.rum.rules.list(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    list(rulesetId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/rum/v2/${rulesetId}/rules`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes an existing rule from a Web Analytics ruleset.
     *
     * @example
     * ```ts
     * const rule = await client.rum.rules.delete(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    delete(rulesetId, ruleId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/rum/v2/${rulesetId}/rule/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Modifies one or more rules in a Web Analytics ruleset with a single request.
     *
     * @example
     * ```ts
     * const response = await client.rum.rules.bulkCreate(
     *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * );
     * ```
     */
    bulkCreate(rulesetId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/rum/v2/${rulesetId}/rules`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=rules.mjs.map