// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.
import { APIResource } from "../../resource.mjs";
import * as AuditLogsAPI from "./audit-logs.mjs";
import { AuditLogs } from "./audit-logs.mjs";
import * as InvitesAPI from "./invites.mjs";
import { Invites, InvitesSinglePage } from "./invites.mjs";
import * as OrganizationsAPI from "./organizations.mjs";
import { Organizations, OrganizationsV4PagePaginationArray, } from "./organizations.mjs";
import * as SubscriptionsAPI from "./subscriptions.mjs";
import { Subscriptions, } from "./subscriptions.mjs";
import * as BillingAPI from "./billing/billing.mjs";
import { Billing } from "./billing/billing.mjs";
import * as TokensAPI from "./tokens/tokens.mjs";
import { Tokens, } from "./tokens/tokens.mjs";
export class User extends APIResource {
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
User.AuditLogs = AuditLogs;
User.Billing = Billing;
User.Invites = Invites;
User.InvitesSinglePage = InvitesSinglePage;
User.Organizations = Organizations;
User.OrganizationsV4PagePaginationArray = OrganizationsV4PagePaginationArray;
User.Subscriptions = Subscriptions;
User.Tokens = Tokens;
//# sourceMappingURL=user.mjs.map