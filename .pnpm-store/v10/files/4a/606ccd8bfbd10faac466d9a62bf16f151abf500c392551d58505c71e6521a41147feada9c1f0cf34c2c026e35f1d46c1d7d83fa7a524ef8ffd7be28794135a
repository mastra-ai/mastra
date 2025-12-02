// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as ReferencesAPI from "./references.mjs";
import { References } from "./references.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Integrations extends APIResource {
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
export class IntegrationListResponsesSinglePage extends SinglePage {
}
Integrations.IntegrationListResponsesSinglePage = IntegrationListResponsesSinglePage;
Integrations.References = References;
//# sourceMappingURL=integrations.mjs.map