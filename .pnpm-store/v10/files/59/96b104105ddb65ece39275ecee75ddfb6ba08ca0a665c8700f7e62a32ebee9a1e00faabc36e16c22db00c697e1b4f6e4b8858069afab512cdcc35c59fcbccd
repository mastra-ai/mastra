// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class BotClass extends APIResource {
    get(botClass, query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get(botClass, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/bot_class/${botClass}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=bot-class.mjs.map