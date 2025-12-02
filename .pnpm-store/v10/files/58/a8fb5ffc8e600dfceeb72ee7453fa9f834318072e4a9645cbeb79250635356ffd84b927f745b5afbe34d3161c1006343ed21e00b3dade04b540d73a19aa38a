"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SeatsSinglePage = exports.Seats = void 0;
const resource_1 = require("../../resource.js");
const pagination_1 = require("../../pagination.js");
class Seats extends resource_1.APIResource {
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
exports.Seats = Seats;
class SeatsSinglePage extends pagination_1.SinglePage {
}
exports.SeatsSinglePage = SeatsSinglePage;
Seats.SeatsSinglePage = SeatsSinglePage;
//# sourceMappingURL=seats.js.map