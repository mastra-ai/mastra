// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AddressSpacesAPI from "./address-spaces.mjs";
import { AddressSpaces, } from "./address-spaces.mjs";
import { SinglePage } from "../../../pagination.mjs";
export class OnRamps extends APIResource {
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
export class OnRampListResponsesSinglePage extends SinglePage {
}
OnRamps.OnRampListResponsesSinglePage = OnRampListResponsesSinglePage;
OnRamps.AddressSpaces = AddressSpaces;
//# sourceMappingURL=on-ramps.mjs.map