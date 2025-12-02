// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as AssetsAPI from "./assets.mjs";
import { Assets } from "./assets.mjs";
import * as PublicAPI from "./public.mjs";
import { Public, PublicListResponsesSinglePage } from "./public.mjs";
export class Finetunes extends APIResource {
    constructor() {
        super(...arguments);
        this.assets = new AssetsAPI.Assets(this._client);
        this.public = new PublicAPI.Public(this._client);
    }
    /**
     * Create a new Finetune
     */
    create(params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai/finetunes`, { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * List Finetunes
     */
    list(params, options) {
        const { account_id } = params;
        return this._client.get(`/accounts/${account_id}/ai/finetunes`, options)._thenUnwrap((obj) => obj.result);
    }
}
Finetunes.Assets = Assets;
Finetunes.Public = Public;
Finetunes.PublicListResponsesSinglePage = PublicListResponsesSinglePage;
//# sourceMappingURL=finetunes.mjs.map