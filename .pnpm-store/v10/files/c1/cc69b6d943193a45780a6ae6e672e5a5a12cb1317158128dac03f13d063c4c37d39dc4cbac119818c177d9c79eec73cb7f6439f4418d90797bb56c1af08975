// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
import * as TopAPI from "./top.mjs";
import { Top } from "./top.mjs";
export class Speed extends APIResource {
    constructor() {
        super(...arguments);
        this.top = new TopAPI.Top(this._client);
    }
    histogram(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.histogram({}, query);
        }
        return this._client.get('/radar/quality/speed/histogram', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    summary(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.summary({}, query);
        }
        return this._client.get('/radar/quality/speed/summary', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Speed.Top = Top;
//# sourceMappingURL=speed.mjs.map