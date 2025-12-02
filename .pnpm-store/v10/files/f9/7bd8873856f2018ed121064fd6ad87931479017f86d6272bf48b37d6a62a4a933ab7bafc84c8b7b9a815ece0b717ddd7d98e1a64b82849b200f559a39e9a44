// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../resource.mjs";
import * as UsersAPI from "./users.mjs";
import { UserListResponsesV4PagePaginationArray, Users } from "./users.mjs";
export class PolicyTests extends APIResource {
    constructor() {
        super(...arguments);
        this.users = new UsersAPI.Users(this._client);
    }
    /**
     * Starts an Access policy test.
     *
     * @example
     * ```ts
     * const policyTest =
     *   await client.zeroTrust.access.applications.policyTests.create(
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/access/policy-tests`, {
            body,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    /**
     * Fetches the current status of a given Access policy test.
     *
     * @example
     * ```ts
     * const policyTest =
     *   await client.zeroTrust.access.applications.policyTests.get(
     *     'f1a8b3c9d4e5f6789a0b1c2d3e4f5678a9b0c1d2e3f4a5b67890c1d2e3f4b5a6',
     *     { account_id: '023e105f4ecef8ad9ca31a8372d0c353' },
     *   );
     * ```
     */
    get(policyTestId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/access/policy-tests/${policyTestId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
PolicyTests.Users = Users;
PolicyTests.UserListResponsesV4PagePaginationArray = UserListResponsesV4PagePaginationArray;
//# sourceMappingURL=policy-tests.mjs.map