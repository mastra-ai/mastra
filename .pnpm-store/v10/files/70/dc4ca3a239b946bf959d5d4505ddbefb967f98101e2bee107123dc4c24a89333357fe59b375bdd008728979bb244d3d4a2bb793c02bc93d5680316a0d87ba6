"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.Summary = void 0;
const resource_1 = require("../../../../resource.js");
const core_1 = require("../../../../core.js");
class Summary extends resource_1.APIResource {
    arc(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.arc({}, query);
        }
        return this._client.get('/radar/email/routing/summary/arc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dkim(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dkim({}, query);
        }
        return this._client.get('/radar/email/routing/summary/dkim', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dmarc(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dmarc({}, query);
        }
        return this._client.get('/radar/email/routing/summary/dmarc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    encrypted(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.encrypted({}, query);
        }
        return this._client.get('/radar/email/routing/summary/encrypted', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    ipVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.ipVersion({}, query);
        }
        return this._client.get('/radar/email/routing/summary/ip_version', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    spf(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.spf({}, query);
        }
        return this._client.get('/radar/email/routing/summary/spf', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map