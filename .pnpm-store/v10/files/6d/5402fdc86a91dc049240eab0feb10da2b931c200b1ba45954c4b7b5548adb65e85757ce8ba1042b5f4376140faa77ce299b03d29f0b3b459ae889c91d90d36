// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as PrebuiltPoliciesAPI from "./prebuilt-policies.mjs";
import { PrebuiltPolicies, PrebuiltPolicyListResponsesSinglePage, } from "./prebuilt-policies.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class CatalogSyncs extends APIResource {
    constructor() {
        super(...arguments);
        this.prebuiltPolicies = new PrebuiltPoliciesAPI.PrebuiltPolicies(this._client);
    }
    /**
     * Create a new Catalog Sync (Closed Beta).
     */
    create(params, options) {
        const { account_id, forwarded, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/catalog-syncs`, {
            body,
            ...options,
            headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Catalog Sync (Closed Beta).
     */
    update(syncId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Catalog Syncs (Closed Beta).
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/catalog-syncs`, CatalogSyncListResponsesSinglePage, options);
    }
    /**
     * Delete a Catalog Sync (Closed Beta).
     */
    delete(syncId, params, options) {
        const { account_id, delete_destination } = params;
        return this._client.delete(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
            query: { delete_destination },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update a Catalog Sync (Closed Beta).
     */
    edit(syncId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Read a Catalog Sync (Closed Beta).
     */
    get(syncId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Refresh a Catalog Sync's destination by running the sync policy against latest
     * resource catalog (Closed Beta).
     */
    refresh(syncId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/catalog-syncs/${syncId}/refresh`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class CatalogSyncListResponsesSinglePage extends SinglePage {
}
CatalogSyncs.CatalogSyncListResponsesSinglePage = CatalogSyncListResponsesSinglePage;
CatalogSyncs.PrebuiltPolicies = PrebuiltPolicies;
CatalogSyncs.PrebuiltPolicyListResponsesSinglePage = PrebuiltPolicyListResponsesSinglePage;
//# sourceMappingURL=catalog-syncs.mjs.map