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
exports.OnRampListResponsesSinglePage = exports.OnRamps = void 0;
const resource_1 = require("../../../resource.js");
const AddressSpacesAPI = __importStar(require("./address-spaces.js"));
const address_spaces_1 = require("./address-spaces.js");
const pagination_1 = require("../../../pagination.js");
class OnRamps extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.addressSpaces = new AddressSpacesAPI.AddressSpaces(this._client);
    }
    /**
     * Create a new On-ramp (Closed Beta).
     */
    create(params, options) {
        const { account_id, forwarded, ...body } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/onramps`, {
            body,
            ...options,
            headers: { ...(forwarded != null ? { forwarded: forwarded } : undefined), ...options?.headers },
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Update an On-ramp (Closed Beta).
     */
    update(onrampId, params, options) {
        const { account_id, ...body } = params;
        return this._client.put(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List On-ramps (Closed Beta).
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/magic/cloud/onramps`, OnRampListResponsesSinglePage, { query, ...options });
    }
    /**
     * Delete an On-ramp (Closed Beta).
     */
    delete(onrampId, params, options) {
        const { account_id, destroy, force } = params;
        return this._client.delete(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
            query: { destroy, force },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Apply an On-ramp (Closed Beta).
     */
    apply(onrampId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/apply`, options);
    }
    /**
     * Update an On-ramp (Closed Beta).
     */
    edit(onrampId, params, options) {
        const { account_id, ...body } = params;
        return this._client.patch(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Export an On-ramp to terraform ready file(s) (Closed Beta).
     */
    export(onrampId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/export`, {
            ...options,
            headers: { Accept: 'application/zip', ...options?.headers },
            __binaryResponse: true,
        });
    }
    /**
     * Read an On-ramp (Closed Beta).
     */
    get(onrampId, params, options) {
        const { account_id, ...query } = params;
        return this._client.get(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Plan an On-ramp (Closed Beta).
     */
    plan(onrampId, params, options) {
        const { account_id } = params;
        return this._client.post(`/accounts/${account_id}/magic/cloud/onramps/${onrampId}/plan`, options);
    }
}
exports.OnRamps = OnRamps;
class OnRampListResponsesSinglePage extends pagination_1.SinglePage {
}
exports.OnRampListResponsesSinglePage = OnRampListResponsesSinglePage;
OnRamps.OnRampListResponsesSinglePage = OnRampListResponsesSinglePage;
OnRamps.AddressSpaces = address_spaces_1.AddressSpaces;
//# sourceMappingURL=on-ramps.js.map