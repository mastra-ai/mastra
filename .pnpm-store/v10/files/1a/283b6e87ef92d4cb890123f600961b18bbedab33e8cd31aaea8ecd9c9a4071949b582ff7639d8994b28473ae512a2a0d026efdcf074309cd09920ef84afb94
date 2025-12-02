// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../../../resource.mjs";
import { isRequestOptions } from "../../../../core.mjs";
export class Summary extends APIResource {
    arc(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.arc({}, query);
        }
        return this._client.get('/radar/email/routing/summary/arc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dkim(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.dkim({}, query);
        }
        return this._client.get('/radar/email/routing/summary/dkim', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dmarc(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.dmarc({}, query);
        }
        return this._client.get('/radar/email/routing/summary/dmarc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    encrypted(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.encrypted({}, query);
        }
        return this._client.get('/radar/email/routing/summary/encrypted', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/email/routing/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    spf(query = {}, options) {
        if (isRequestOptions(query)) {
            return this.spf({}, query);
        }
        return this._client.get('/radar/email/routing/summary/spf', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
//# sourceMappingURL=summary.mjs.map