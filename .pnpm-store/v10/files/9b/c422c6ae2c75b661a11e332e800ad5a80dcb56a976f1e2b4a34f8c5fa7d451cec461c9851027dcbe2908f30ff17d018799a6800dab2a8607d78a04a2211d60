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
exports.MagicNetworkMonitoringRulesSinglePage = exports.Rules = void 0;
const resource_1 = require("../../../resource.js");
const AdvertisementsAPI = __importStar(require("./advertisements.js"));
const advertisements_1 = require("./advertisements.js");
const pagination_1 = require("../../../pagination.js");
class Rules extends resource_1.APIResource {
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
exports.Rules = Rules;
class MagicNetworkMonitoringRulesSinglePage extends pagination_1.SinglePage {
}
exports.MagicNetworkMonitoringRulesSinglePage = MagicNetworkMonitoringRulesSinglePage;
Rules.MagicNetworkMonitoringRulesSinglePage = MagicNetworkMonitoringRulesSinglePage;
Rules.Advertisements = advertisements_1.Advertisements;
//# sourceMappingURL=rules.js.map