// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../resource';
import * as Core from '../../core';
import * as AuditLogsAPI from './audit-logs';
import { AuditLogListParams, AuditLogs } from './audit-logs';
import * as InvitesAPI from './invites';
import { Invite, InviteEditParams, Invites, InvitesSinglePage } from './invites';
import * as OrganizationsAPI from './organizations';
import {
  Organization,
  OrganizationDeleteResponse,
  OrganizationGetResponse,
  OrganizationListParams,
  Organizations,
  OrganizationsV4PagePaginationArray,
} from './organizations';
import * as SubscriptionsAPI from './subscriptions';
import {
  SubscriptionDeleteResponse,
  SubscriptionUpdateParams,
  SubscriptionUpdateResponse,
  Subscriptions,
} from './subscriptions';
import * as BillingAPI from './billing/billing';
import { Billing } from './billing/billing';
import * as TokensAPI from './tokens/tokens';
import {
  TokenCreateParams,
  TokenCreateResponse,
  TokenDeleteResponse,
  TokenListParams,
  TokenUpdateParams,
  TokenVerifyResponse,
  Tokens,
} from './tokens/tokens';

export class User extends APIResource {
  auditLogs: AuditLogsAPI.AuditLogs = new AuditLogsAPI.AuditLogs(this._client);
  billing: BillingAPI.Billing = new BillingAPI.Billing(this._client);
  invites: InvitesAPI.Invites = new InvitesAPI.Invites(this._client);
  organizations: OrganizationsAPI.Organizations = new OrganizationsAPI.Organizations(this._client);
  subscriptions: SubscriptionsAPI.Subscriptions = new SubscriptionsAPI.Subscriptions(this._client);
  tokens: TokensAPI.Tokens = new TokensAPI.Tokens(this._client);

  /**
   * Edit part of your user details.
   *
   * @example
   * ```ts
   * const response = await client.user.edit();
   * ```
   */
  edit(body: UserEditParams, options?: Core.RequestOptions): Core.APIPromise<UserEditResponse> {
    return (
      this._client.patch('/user', { body, ...options }) as Core.APIPromise<{ result: UserEditResponse }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * User Details
   *
   * @example
   * ```ts
   * const user = await client.user.get();
   * ```
   */
  get(options?: Core.RequestOptions): Core.APIPromise<UserGetResponse> {
    return (this._client.get('/user', options) as Core.APIPromise<{ result: UserGetResponse }>)._thenUnwrap(
      (obj) => obj.result,
    );
  }
}

export interface UserEditResponse {
  /**
   * Identifier of the user.
   */
  id?: string;

  /**
   * Lists the betas that the user is participating in.
   */
  betas?: Array<string>;

  /**
   * The country in which the user lives.
   */
  country?: string | null;

  /**
   * User's first name
   */
  first_name?: string | null;

  /**
   * Indicates whether user has any business zones
   */
  has_business_zones?: boolean;

  /**
   * Indicates whether user has any enterprise zones
   */
  has_enterprise_zones?: boolean;

  /**
   * Indicates whether user has any pro zones
   */
  has_pro_zones?: boolean;

  /**
   * User's last name
   */
  last_name?: string | null;

  organizations?: Array<OrganizationsAPI.Organization>;

  /**
   * Indicates whether user has been suspended
   */
  suspended?: boolean;

  /**
   * User's telephone number
   */
  telephone?: string | null;

  /**
   * Indicates whether two-factor authentication is enabled for the user account.
   * Does not apply to API authentication.
   */
  two_factor_authentication_enabled?: boolean;

  /**
   * Indicates whether two-factor authentication is required by one of the accounts
   * that the user is a member of.
   */
  two_factor_authentication_locked?: boolean;

  /**
   * The zipcode or postal code where the user lives.
   */
  zipcode?: string | null;
}

export interface UserGetResponse {
  /**
   * Identifier of the user.
   */
  id?: string;

  /**
   * Lists the betas that the user is participating in.
   */
  betas?: Array<string>;

  /**
   * The country in which the user lives.
   */
  country?: string | null;

  /**
   * User's first name
   */
  first_name?: string | null;

  /**
   * Indicates whether user has any business zones
   */
  has_business_zones?: boolean;

  /**
   * Indicates whether user has any enterprise zones
   */
  has_enterprise_zones?: boolean;

  /**
   * Indicates whether user has any pro zones
   */
  has_pro_zones?: boolean;

  /**
   * User's last name
   */
  last_name?: string | null;

  organizations?: Array<OrganizationsAPI.Organization>;

  /**
   * Indicates whether user has been suspended
   */
  suspended?: boolean;

  /**
   * User's telephone number
   */
  telephone?: string | null;

  /**
   * Indicates whether two-factor authentication is enabled for the user account.
   * Does not apply to API authentication.
   */
  two_factor_authentication_enabled?: boolean;

  /**
   * Indicates whether two-factor authentication is required by one of the accounts
   * that the user is a member of.
   */
  two_factor_authentication_locked?: boolean;

  /**
   * The zipcode or postal code where the user lives.
   */
  zipcode?: string | null;
}

export interface UserEditParams {
  /**
   * The country in which the user lives.
   */
  country?: string | null;

  /**
   * User's first name
   */
  first_name?: string | null;

  /**
   * User's last name
   */
  last_name?: string | null;

  /**
   * User's telephone number
   */
  telephone?: string | null;

  /**
   * The zipcode or postal code where the user lives.
   */
  zipcode?: string | null;
}

User.AuditLogs = AuditLogs;
User.Billing = Billing;
User.Invites = Invites;
User.InvitesSinglePage = InvitesSinglePage;
User.Organizations = Organizations;
User.OrganizationsV4PagePaginationArray = OrganizationsV4PagePaginationArray;
User.Subscriptions = Subscriptions;
User.Tokens = Tokens;

export declare namespace User {
  export {
    type UserEditResponse as UserEditResponse,
    type UserGetResponse as UserGetResponse,
    type UserEditParams as UserEditParams,
  };

  export { AuditLogs as AuditLogs, type AuditLogListParams as AuditLogListParams };

  export { Billing as Billing };

  export {
    Invites as Invites,
    type Invite as Invite,
    InvitesSinglePage as InvitesSinglePage,
    type InviteEditParams as InviteEditParams,
  };

  export {
    Organizations as Organizations,
    type Organization as Organization,
    type OrganizationDeleteResponse as OrganizationDeleteResponse,
    type OrganizationGetResponse as OrganizationGetResponse,
    OrganizationsV4PagePaginationArray as OrganizationsV4PagePaginationArray,
    type OrganizationListParams as OrganizationListParams,
  };

  export {
    Subscriptions as Subscriptions,
    type SubscriptionUpdateResponse as SubscriptionUpdateResponse,
    type SubscriptionDeleteResponse as SubscriptionDeleteResponse,
    type SubscriptionUpdateParams as SubscriptionUpdateParams,
  };

  export {
    Tokens as Tokens,
    type TokenCreateResponse as TokenCreateResponse,
    type TokenDeleteResponse as TokenDeleteResponse,
    type TokenVerifyResponse as TokenVerifyResponse,
    type TokenCreateParams as TokenCreateParams,
    type TokenUpdateParams as TokenUpdateParams,
    type TokenListParams as TokenListParams,
  };
}
