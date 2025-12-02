"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotClass = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class BotClass extends resource_1.APIResource {
    get(botClass, query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.get(botClass, {}, query);
        }
        return this._client.get(`/radar/http/top/ases/bot_class/${botClass}`, {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.BotClass = BotClass;
//# sourceMappingURL=bot-class.js.map