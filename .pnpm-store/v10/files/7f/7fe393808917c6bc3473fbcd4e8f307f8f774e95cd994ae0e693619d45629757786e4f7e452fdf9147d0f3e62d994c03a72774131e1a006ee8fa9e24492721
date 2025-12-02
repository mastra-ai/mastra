"use strict";
// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
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
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const resource_1 = require("../../resource.js");
const AuditLogsAPI = __importStar(require("./audit-logs.js"));
const audit_logs_1 = require("./audit-logs.js");
const InvitesAPI = __importStar(require("./invites.js"));
const invites_1 = require("./invites.js");
const OrganizationsAPI = __importStar(require("./organizations.js"));
const organizations_1 = require("./organizations.js");
const SubscriptionsAPI = __importStar(require("./subscriptions.js"));
const subscriptions_1 = require("./subscriptions.js");
const BillingAPI = __importStar(require("./billing/billing.js"));
const billing_1 = require("./billing/billing.js");
const TokensAPI = __importStar(require("./tokens/tokens.js"));
const tokens_1 = require("./tokens/tokens.js");
class User extends resource_1.APIResource {
    constructor() {
        super(...arguments);
        this.auditLogs = new AuditLogsAPI.AuditLogs(this._client);
        this.billing = new BillingAPI.Billing(this._client);
        this.invites = new InvitesAPI.Invites(this._client);
        this.organizations = new OrganizationsAPI.Organizations(this._client);
        this.subscriptions = new SubscriptionsAPI.Subscriptions(this._client);
        this.tokens = new TokensAPI.Tokens(this._client);
    }
    /**
     * Edit part of your user details.
     *
     * @example
     * ```ts
     * const response = await client.user.edit();
     * ```
     */
    edit(body, options) {
        return this._client.patch('/user', { body, ...options })._thenUnwrap((obj) => obj.result);
    }
    /**
     * User Details
     *
     * @example
     * ```ts
     * const user = await client.user.get();
     * ```
     */
    get(options) {
        return this._client.get('/user', options)._thenUnwrap((obj) => obj.result);
    }
}
exports.User = User;
User.AuditLogs = audit_logs_1.AuditLogs;
User.Billing = billing_1.Billing;
User.Invites = invites_1.Invites;
User.InvitesSinglePage = invites_1.InvitesSinglePage;
User.Organizations = organizations_1.Organizations;
User.OrganizationsV4PagePaginationArray = organizations_1.OrganizationsV4PagePaginationArray;
User.Subscriptions = subscriptions_1.Subscriptions;
User.Tokens = tokens_1.Tokens;
//# sourceMappingURL=user.js.map