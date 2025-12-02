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
exports.IntegrationListResponsesSinglePage = exports.Integrations = void 0;
const resource_1 = require("../../../../resource.js");
const ReferencesAPI = __importStar(require("./references.js"));
const references_1 = require("./references.js");
const pagination_1 = require("../../../../pagination.js");
class Integrations extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.references = new ReferencesAPI.References(this._client);
    }
    /**
     * Create new risk score integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.riskScoring.integrations.create({
     *     account_id: 'account_id',
     *     integration_type: 'Okta',
     *     tenant_url: 'https://example.com',
     *   });
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/zt_risk_scoring/integrations`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Overwrite the reference_id, tenant_url, and active values with the ones
     * provided.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.riskScoring.integrations.update(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     {
     *       account_id: 'account_id',
     *       active: true,
     *       tenant_url: 'https://example.com',
     *     },
     *   );
     * ```
     */
    update(integrationId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List all risk score integrations for the account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const integrationListResponse of client.zeroTrust.riskScoring.integrations.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/zt_risk_scoring/integrations`, IntegrationListResponsesSinglePage, options);
    }
    /**
     * Delete a risk score integration.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.riskScoring.integrations.delete(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(integrationId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get risk score integration by id.
     *
     * @example
     * ```ts
     * const integration =
     *   await client.zeroTrust.riskScoring.integrations.get(
     *     '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(integrationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/zt_risk_scoring/integrations/${integrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
exports.Integrations = Integrations;
class IntegrationListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;
Integrations.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;
Integrations.References = references_1.References;
//# sourceMappingURL=integrations.js.map