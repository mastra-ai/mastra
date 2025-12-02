// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { CursorPagination } from "../../../pagination.mjs";
export class Registrations extends APIResource {
    /**
     * Lists WARP registrations.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const registrationListResponse of client.zeroTrust.devices.registrations.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/devices/registrations`, RegistrationListResponsesCursorPagination, { query, ...options });
    }
    /**
     * Deletes a WARP registration.
     *
     * @example
     * ```ts
     * const registration =
     *   await client.zeroTrust.devices.registrations.delete(
     *     'registration_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    delete(registrationId, params, options) {
        const { account_id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/registrations/${registrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Deletes a list of WARP registrations.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.registrations.bulkDelete({
     *     account_id: 'account_id',
     *     id: ['string'],
     *   });
     * ```
     */
    bulkDelete(params, options) {
        const { account_id, id } = params;
        return this._client.delete(`/accounts/${account_id}/devices/registrations`, {
            query: { id },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches a single WARP registration.
     *
     * @example
     * ```ts
     * const registration =
     *   await client.zeroTrust.devices.registrations.get(
     *     'registration_id',
     *     { account_id: 'account_id' },
     *   );
     * ```
     */
    get(registrationId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/devices/registrations/${registrationId}`, options)._thenUnwrap((obj) => obj.result);
    }
    /**
     * Revokes a list of WARP registrations.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.registrations.revoke({
     *     account_id: 'account_id',
     *     id: ['string'],
     *   });
     * ```
     */
    revoke(params, options) {
        const { account_id, id } = params;
        return this._client.post(`/accounts/${account_id}/devices/registrations/revoke`, {
            query: { id },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Unrevokes a list of WARP registrations.
     *
     * @example
     * ```ts
     * const response =
     *   await client.zeroTrust.devices.registrations.unrevoke({
     *     account_id: 'account_id',
     *     id: ['string'],
     *   });
     * ```
     */
    unrevoke(params, options) {
        const { account_id, id } = params;
        return this._client.post(`/accounts/${account_id}/devices/registrations/unrevoke`, {
            query: { id },
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
export class RegistrationListResponsesCursorPagination extends CursorPagination {
}
Registrations.RegistrationListResponsesCursorPagination = RegistrationListResponsesCursorPagination;
//# sourceMappingURL=registrations.mjs.map