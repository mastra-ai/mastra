// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import { SinglePage } from "../../pagination.mjs";
export class Seats extends APIResource {
    /**
     * Removes a user from a Zero Trust seat when both `access_seat` and `gateway_seat`
     * are set to false.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const seat of client.zeroTrust.seats.edit({
     *   account_id: '699d98642c564d2e855e9661899b7252',
     *   body: [
     *     {
     *       access_seat: false,
     *       gateway_seat: false,
     *       seat_uid: 'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
     *     },
     *   ],
     * })) {
     *   // ...
     * }
     * ```
     */
    edit(params, options) {
        const { account_id, body } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/seats`, SeatsSinglePage, {
            body: body,
            method: 'patch',
            ...options,
        });
    }
}
export class SeatsSinglePage extends SinglePage {
}
Seats.SeatsSinglePage = SeatsSinglePage;
//# sourceMappingURL=seats.mjs.map