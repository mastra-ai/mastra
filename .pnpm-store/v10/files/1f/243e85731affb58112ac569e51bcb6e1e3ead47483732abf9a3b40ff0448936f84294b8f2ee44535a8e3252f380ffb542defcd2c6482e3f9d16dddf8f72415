// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class CloudIntegrations extends APIResource {
    /**
     * Create a new Cloud Integration (Closed Beta).
     */
    create(params, options) {
        const { account_id, forwarded, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/providers`, {
            body,
            ...options,
            headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Cloud Integration (Closed Beta).
     */
    update(providerId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Cloud Integrations (Closed Beta).
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/providers`, CloudIntegrationListResponsesSinglePage, { query, ...options });
    }
    /**
     * Delete a Cloud Integration (Closed Beta).
     */
    delete(providerId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Run discovery for a Cloud Integration (Closed Beta).
     */
    discover(providerId, params, options) {
        const { account_id, v2 } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/providers/${providerId}/discover`, {
            query: { v2 },
            ...options,
        });
    }
    /**
     * Run discovery for all Cloud Integrations in an account (Closed Beta).
     */
    discoverAll(params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/providers/discover`, options);
    }
    /**
     * Update a Cloud Integration (Closed Beta).
     */
    edit(providerId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Read a Cloud Integration (Closed Beta).
     */
    get(providerId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/providers/${providerId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Get initial configuration to complete Cloud Integration setup (Closed Beta).
     */
    initialSetup(providerId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/providers/${providerId}/initial_setup`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class CloudIntegrationListResponsesSinglePage extends SinglePage {
}
CloudIntegrations.CloudIntegrationListResponsesSinglePage = CloudIntegrationListResponsesSinglePage;
//# sourceMappingURL=cloud-integrations.mjs.map