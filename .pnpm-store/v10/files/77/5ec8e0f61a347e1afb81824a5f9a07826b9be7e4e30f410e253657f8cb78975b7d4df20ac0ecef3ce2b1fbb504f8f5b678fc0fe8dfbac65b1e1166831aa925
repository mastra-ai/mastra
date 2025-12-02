"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkOS = void 0;
const node_crypto_provider_1 = require("./common/crypto/node-crypto-provider");
const subtle_crypto_provider_1 = require("./common/crypto/subtle-crypto-provider");
const fetch_client_1 = require("./common/net/fetch-client");
const node_client_1 = require("./common/net/node-client");
const actions_1 = require("./actions/actions");
const webhooks_1 = require("./webhooks/webhooks");
const workos_1 = require("./workos");
const web_iron_session_provider_1 = require("./common/iron-session/web-iron-session-provider");
__exportStar(require("./actions/interfaces"), exports);
__exportStar(require("./audit-logs/interfaces"), exports);
__exportStar(require("./common/exceptions"), exports);
__exportStar(require("./common/interfaces"), exports);
__exportStar(require("./common/utils/pagination"), exports);
__exportStar(require("./directory-sync/interfaces"), exports);
__exportStar(require("./directory-sync/utils/get-primary-email"), exports);
__exportStar(require("./events/interfaces"), exports);
__exportStar(require("./fga/interfaces"), exports);
__exportStar(require("./organizations/interfaces"), exports);
__exportStar(require("./organization-domains/interfaces"), exports);
__exportStar(require("./passwordless/interfaces"), exports);
__exportStar(require("./portal/interfaces"), exports);
__exportStar(require("./sso/interfaces"), exports);
__exportStar(require("./user-management/interfaces"), exports);
__exportStar(require("./roles/interfaces"), exports);
class WorkOSNode extends workos_1.WorkOS {
    /** @override */
    createHttpClient(options, userAgent) {
        var _a;
        const opts = Object.assign(Object.assign({}, options.config), { timeout: options.timeout, headers: Object.assign(Object.assign({}, (_a = options.config) === null || _a === void 0 ? void 0 : _a.headers), { Authorization: `Bearer ${this.key}`, 'User-Agent': userAgent }) });
        if (typeof fetch !== 'undefined' ||
            typeof options.fetchFn !== 'undefined') {
            return new fetch_client_1.FetchHttpClient(this.baseURL, opts, options.fetchFn);
        }
        else {
            return new node_client_1.NodeHttpClient(this.baseURL, opts);
        }
    }
    /** @override */
    createWebhookClient() {
        return new webhooks_1.Webhooks(this.getCryptoProvider());
    }
    getCryptoProvider() {
        let cryptoProvider;
        if (typeof crypto !== 'undefined' && typeof crypto.subtle !== 'undefined') {
            cryptoProvider = new subtle_crypto_provider_1.SubtleCryptoProvider();
        }
        else {
            cryptoProvider = new node_crypto_provider_1.NodeCryptoProvider();
        }
        return cryptoProvider;
    }
    /** @override */
    createActionsClient() {
        return new actions_1.Actions(this.getCryptoProvider());
    }
    /** @override */
    createIronSessionProvider() {
        return new web_iron_session_provider_1.WebIronSessionProvider();
    }
    /** @override */
    emitWarning(warning) {
        return process.emitWarning(warning, 'WorkOS');
    }
}
exports.WorkOS = WorkOSNode;
