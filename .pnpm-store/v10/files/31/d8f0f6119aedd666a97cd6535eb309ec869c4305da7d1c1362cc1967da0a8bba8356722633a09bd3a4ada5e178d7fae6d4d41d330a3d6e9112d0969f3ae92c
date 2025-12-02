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
exports.TestsV4PagePagination = exports.Tests = void 0;
const resource_1 = require("../../../../resource.js");
const UniqueDevicesAPI = __importStar(require("./unique-devices.js"));
const pagination_1 = require("../../../../pagination.js");
class Tests extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.uniqueDevices = new UniqueDevicesAPI.UniqueDevices(this._client);
    }
    /**
     * List DEX tests with overview metrics
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const tests of client.zeroTrust.dex.tests.list({
     *   account_id: '01a7362d577a6c3019a474fd6f485823',
     * })) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dex/tests/overview`, TestsV4PagePagination, {
            query,
            ...options,
        });
    }
}
exports.Tests = Tests;
class TestsV4PagePagination extends pagination_1.V4PagePagination {
}
exports.TestsV4PagePagination = TestsV4PagePagination;
Tests.TestsV4PagePagination = TestsV4PagePagination;
//# sourceMappingURL=tests.js.map