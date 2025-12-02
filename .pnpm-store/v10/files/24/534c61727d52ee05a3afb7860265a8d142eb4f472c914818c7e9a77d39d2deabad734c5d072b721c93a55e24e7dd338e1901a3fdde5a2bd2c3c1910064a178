// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../../../resource.mjs";
import { isRequestOptions } from "../../../../../../core.mjs";
import * as MaliciousAPI from "./malicious.mjs";
import { Malicious } from "./malicious.mjs";
import * as SpamAPI from "./spam.mjs";
import { Spam } from "./spam.mjs";
import * as SpoofAPI from "./spoof.mjs";
import { Spoof } from "./spoof.mjs";
export class Tlds extends APIResource {
    constructor() {
        super(...arguments);
        this.malicious = new MaliciousAPI.Malicious(this._client);
        this.spam = new SpamAPI.Spam(this._client);
        this.spoof = new SpoofAPI.Spoof(this._client);
    }
    get(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.get({}, query);
        }
        return this._client.get('/radar/email/security/top/tlds', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
Tlds.Malicious = Malicious;
Tlds.Spam = Spam;
Tlds.Spoof = Spoof;
//# sourceMappingURL=tlds.mjs.map