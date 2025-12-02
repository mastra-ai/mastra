// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as UniqueDevicesAPI from "./unique-devices.mjs";
import { V4PagePagination } from "../../../../pagination.mjs";
export class Tests extends APIResource {
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
export class TestsV4PagePagination extends V4PagePagination {
}
Tests.TestsV4PagePagination = TestsV4PagePagination;
//# sourceMappingURL=tests.mjs.map