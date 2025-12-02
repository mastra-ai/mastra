// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import * as Core from "../../../core.mjs";
export class Assets extends APIResource {
    /**
     * Upload a Finetune Asset
     */
    create(finetuneId, params, options) {
        const { account_id, ...body } = params;
        return this._client.post(`/accounts/${account_id}/ai/finetunes/${finetuneId}/finetune-assets`, Core.multipartFormRequestOptions({ body, ...options }))._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=assets.mjs.map