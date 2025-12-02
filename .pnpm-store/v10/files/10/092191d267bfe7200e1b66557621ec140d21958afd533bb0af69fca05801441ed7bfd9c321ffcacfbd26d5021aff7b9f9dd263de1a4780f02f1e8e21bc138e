// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AdvertisementsAPI from "./advertisements.mjs";
import { Advertisements } from "./advertisements.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class Rules extends APIResource {
    constructor() {
        super(...arguments);
        this.advertisements = new AdvertisementsAPI.Advertisements(this._client);
    }
    /**
     * Create network monitoring rules for account. Currently only supports creating a
     * single rule per API request.
     *
     * @example
     * ```ts
     * const magicNetworkMonitoringRule =
     *   await client.magicNetworkMonitoring.rules.create({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     duration: '1m',
     *     name: 'my_rule_1',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/mnm/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update network monitoring rules for account.
     *
     * @example
     * ```ts
     * const magicNetworkMonitoringRule =
     *   await client.magicNetworkMonitoring.rules.update({
     *     account_id: '6f91088a406011ed95aed352566e8d4c',
     *     duration: '1m',
     *     name: 'my_rule_1',
     *   });
     * ```
     */
    update(params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/mnm/rules`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Lists network monitoring rules for account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const magicNetworkMonitoringRule of client.magicNetworkMonitoring.rules.list(
     *   { account_id: '6f91088a406011ed95aed352566e8d4c' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/mnm/rules`, MagicNetworkMonitoringRulesSinglePage, options);
    }
    /**
     * Delete a network monitoring rule for account.
     *
     * @example
     * ```ts
     * const magicNetworkMonitoringRule =
     *   await client.magicNetworkMonitoring.rules.delete(
     *     '2890e6fa406311ed9b5a23f70f6fb8cf',
     *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
     *   );
     * ```
     */
    delete(ruleId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/mnm/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a network monitoring rule for account.
     *
     * @example
     * ```ts
     * const magicNetworkMonitoringRule =
     *   await client.magicNetworkMonitoring.rules.edit(
     *     '2890e6fa406311ed9b5a23f70f6fb8cf',
     *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
     *   );
     * ```
     */
    edit(ruleId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/mnm/rules/${ruleId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List a single network monitoring rule for account.
     *
     * @example
     * ```ts
     * const magicNetworkMonitoringRule =
     *   await client.magicNetworkMonitoring.rules.get(
     *     '2890e6fa406311ed9b5a23f70f6fb8cf',
     *     { account_id: '6f91088a406011ed95aed352566e8d4c' },
     *   );
     * ```
     */
    get(ruleId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/mnm/rules/${ruleId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class MagicNetworkMonitoringRulesSinglePage extends SinglePage {
}
Rules.MagicNetworkMonitoringRulesSinglePage = MagicNetworkMonitoringRulesSinglePage;
Rules.Advertisements = Advertisements;
//# sourceMappingURL=rules.mjs.map