// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../resource.mjs";
import { isRequestOptions } from "../../../core.mjs";
import * as TopAPI from "./top.mjs";
import { Top } from "./top.mjs";
export class Netflows extends APIResource {
    constructor() {
        super(...arguments);
        this.top = new TopAPI.Top(this._client);
    }
    summary(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.summary({}, query);
        }
        return this._client.get('/radar/netflows/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    timeseries(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.timeseries({}, query);
        }
        return this._client.get('/radar/netflows/timeseries', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Netflows.Top = Top;
//# sourceMappingURL=netflows.mjs.map