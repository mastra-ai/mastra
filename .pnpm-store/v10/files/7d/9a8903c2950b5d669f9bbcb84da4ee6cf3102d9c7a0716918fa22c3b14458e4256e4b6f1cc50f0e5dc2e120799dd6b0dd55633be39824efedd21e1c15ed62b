"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserListResponsesV4PagePaginationArray = exports.Users = void 0;
const resource_1 = require("../../../../../resource.js");
const pagination_1 = require("../../../../../pagination.js");
class Users extends resource_1.APIResource {
    /**
     * Fetches a single page of user results from an Access policy test.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const userListResponse of client.zeroTrust.access.applications.policyTests.users.list(
     *   'f1a8b3c9d4e5f6789a0b1c2d3e4f5678a9b0c1d2e3f4a5b67890c1d2e3f4b5a6',
     *   { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(policyTestId, params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/access/policy-tests/${policyTestId}/users`, UserListResponsesV4PagePaginationArray, { query, ...options });
    }
}
exports.Users = Users;
class UserListResponsesV4PagePaginationArray extends pagination_1.V4PagePaginationArray {
}
exports.UserListResponsesV4PagePaginationArray = UserListResponsesV4PagePaginationArray;
Users.UserListResponsesV4PagePaginationArray = UserListResponsesV4PagePaginationArray;
//# sourceMappingURL=users.js.map