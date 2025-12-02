// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import * as CustomAPI from "./custom.mjs";
import { Custom, } from "./custom.mjs";
import * as PredefinedAPI from "./predefined.mjs";
import { Predefined, } from "./predefined.mjs";
import { SinglePage } from "../../../../pagination.mjs";
export class Profiles extends APIResource {
    constructor() {
        super(...arguments);
        this.custom = new CustomAPI.Custom(this._client);
        this.predefined = new PredefinedAPI.Predefined(this._client);
    }
    /**
     * Lists all DLP profiles in an account.
     *
     * @example
     * ```ts
     * // Automatically fetches more pages as needed.
     * for await (const profile of client.zeroTrust.dlp.profiles.list(
     *   { account_id: 'account_id' },
     * )) {
     *   // ...
     * }
     * ```
     */
    list(params, options) {
        const { account_id, ...query } = params;
        return this._client.getAPIList(`/accounts/${account_id}/dlp/profiles`, ProfilesSinglePage, {
            query,
            ...options,
        });
    }
    /**
     * Fetches a DLP profile by ID.
     *
     * @example
     * ```ts
     * const profile = await client.zeroTrust.dlp.profiles.get(
     *   '182bd5e5-6e1a-4fe4-a799-aa6d9a6ab26e',
     *   { account_id: 'account_id' },
     * );
     * ```
     */
    get(profileId, params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/dlp/profiles/${profileId}`, options)._thenUnwrap((obj) => obj.result);
    }
}
export class ProfilesSinglePage extends SinglePage {
}
Profiles.ProfilesSinglePage = ProfilesSinglePage;
Profiles.Custom = Custom;
Profiles.Predefined = Predefined;
//# sourceMappingURL=profiles.mjs.map