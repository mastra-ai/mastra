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
        return this._client.get('/radar/email/security/summary/arc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dkim(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dkim({}, query);
        }
        return this._client.get('/radar/email/security/summary/dkim', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    dmarc(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.dmarc({}, query);
        }
        return this._client.get('/radar/email/security/summary/dmarc', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    malicious(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.malicious({}, query);
        }
        return this._client.get('/radar/email/security/summary/malicious', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    spam(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.spam({}, query);
        }
        return this._client.get('/radar/email/security/summary/spam', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    spf(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.spf({}, query);
        }
        return this._client.get('/radar/email/security/summary/spf', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    spoof(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.spoof({}, query);
        }
        return this._client.get('/radar/email/security/summary/spoof', { query, ...options })._thenUnwrap((obj) => obj.result);
    }
    threatCategory(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.threatCategory({}, query);
        }
        return this._client.get('/radar/email/security/summary/threat_category', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
    tlsVersion(query = {}, options) {
        if ((0, core_1.isRequestOptions)(query)) {
            return this.tlsVersion({}, query);
        }
        return this._client.get('/radar/email/security/summary/tls_version', {
            query,
            ...options,
        })._thenUnwrap((obj) => obj.result);
    }
}
exports.Summary = Summary;
//# sourceMappingURL=summary.js.map