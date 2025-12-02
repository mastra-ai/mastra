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
exports.PolicyTests = void 0;
const resource_1 = require("../../../../../resource.js");
const UsersAPI = __importStar(require("./users.js"));
const users_1 = require("./users.js");
class PolicyTests extends resource_1.APIResource {
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
exports.PolicyTests = PolicyTests;
PolicyTests.Users = users_1.Users;
PolicyTests.UserListResponsesV4PagePaginationArray = users_1.UserListResponsesV4PagePaginationArray;
//# sourceMappingURL=policy-tests.js.map