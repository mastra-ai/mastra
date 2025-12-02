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
exports.CatalogSyncListResponsesSinglePage = exports.CatalogSyncs = void 0;
const resource_1 = require("../../../resource.js");
const PrebuiltPoliciesAPI = __importStar(require("./prebuilt-policies.js"));
const prebuilt_policies_1 = require("./prebuilt-policies.js");
const pagination_1 = require("../../../pagination.js");
class CatalogSyncs extends resource_1.APIResource {
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
exports.CatalogSyncs = CatalogSyncs;
class CatalogSyncListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.CatalogSyncListResponsesSinglePage = CatalogSyncListResponsesSinglePage;
CatalogSyncs.CatalogSyncListResponsesSinglePage = CatalogSyncListResponsesSinglePage;
CatalogSyncs.PrebuiltPolicies = prebuilt_policies_1.PrebuiltPolicies;
CatalogSyncs.PrebuiltPolicyListResponsesSinglePage = prebuilt_policies_1.PrebuiltPolicyListResponsesSinglePage;
//# sourceMappingURL=catalog-syncs.js.map