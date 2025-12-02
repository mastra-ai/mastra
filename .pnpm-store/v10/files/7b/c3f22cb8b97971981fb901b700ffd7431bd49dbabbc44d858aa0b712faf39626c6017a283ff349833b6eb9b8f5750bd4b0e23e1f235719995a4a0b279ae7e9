// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import * as Shared from './shared';
import { SinglePage, V4PagePaginationArray } from '../pagination';

export type ASN = number;

export type ASNParam = number;

export interface AuditLog {
  /**
   * A string that uniquely identifies the audit log.
   */
  id?: string;

  action?: AuditLog.Action;

  actor?: AuditLog.Actor;

  /**
   * The source of the event.
   */
  interface?: string;

  /**
   * An object which can lend more context to the action being logged. This is a
   * flexible value and varies between different actions.
   */
  metadata?: unknown;

  /**
   * The new value of the resource that was modified.
   */
  newValue?: string;

  /**
   * The value of the resource before it was modified.
   */
  oldValue?: string;

  owner?: AuditLog.Owner;

  resource?: AuditLog.Resource;

  /**
   * A UTC RFC3339 timestamp that specifies when the action being logged occured.
   */
  when?: string;
}

export namespace AuditLog {
  export interface Action {
    /**
     * A boolean that indicates if the action attempted was successful.
     */
    result?: boolean;

    /**
     * A short string that describes the action that was performed.
     */
    type?: string;
  }

  export interface Actor {
    /**
     * The ID of the actor that performed the action. If a user performed the action,
     * this will be their User ID.
     */
    id?: string;

    /**
     * The email of the user that performed the action.
     */
    email?: string;

    /**
     * The IP address of the request that performed the action.
     */
    ip?: string;

    /**
     * The type of actor, whether a User, Cloudflare Admin, or an Automated System.
     */
    type?: 'user' | 'admin' | 'Cloudflare';
  }

  export interface Owner {
    /**
     * Identifier
     */
    id?: string;
  }

  export interface Resource {
    /**
     * An identifier for the resource that was affected by the action.
     */
    id?: string;

    /**
     * A short string that describes the resource that was affected by the action.
     */
    type?: string;
  }
}

/**
 * The Certificate Authority that will issue the certificate
 */
export type CertificateCA = 'digicert' | 'google' | 'lets_encrypt' | 'ssl_com';

/**
 * The Certificate Authority that will issue the certificate
 */
export type CertificateCAParam = 'digicert' | 'google' | 'lets_encrypt' | 'ssl_com';

/**
 * Signature type desired on certificate ("origin-rsa" (rsa), "origin-ecc" (ecdsa),
 * or "keyless-certificate" (for Keyless SSL servers).
 */
export type CertificateRequestType = 'origin-rsa' | 'origin-ecc' | 'keyless-certificate';

/**
 * Signature type desired on certificate ("origin-rsa" (rsa), "origin-ecc" (ecdsa),
 * or "keyless-certificate" (for Keyless SSL servers).
 */
export type CertificateRequestTypeParam = 'origin-rsa' | 'origin-ecc' | 'keyless-certificate';

/**
 * A Cloudflare Tunnel that connects your origin to Cloudflare's edge.
 */
export interface CloudflareTunnel {
  /**
   * UUID of the tunnel.
   */
  id?: string;

  /**
   * Cloudflare account ID
   */
  account_tag?: string;

  /**
   * @deprecated This field will start returning an empty array. To fetch the
   * connections of a given tunnel, please use the dedicated endpoint
   * `/accounts/{account_id}/{tunnel_type}/{tunnel_id}/connections`
   */
  connections?: Array<CloudflareTunnel.Connection>;

  /**
   * Timestamp of when the tunnel established at least one connection to Cloudflare's
   * edge. If `null`, the tunnel is inactive.
   */
  conns_active_at?: string;

  /**
   * Timestamp of when the tunnel became inactive (no connections to Cloudflare's
   * edge). If `null`, the tunnel is active.
   */
  conns_inactive_at?: string;

  /**
   * Timestamp of when the resource was created.
   */
  created_at?: string;

  /**
   * Timestamp of when the resource was deleted. If `null`, the resource has not been
   * deleted.
   */
  deleted_at?: string;

  /**
   * Metadata associated with the tunnel.
   */
  metadata?: unknown;

  /**
   * A user-friendly name for a tunnel.
   */
  name?: string;

  /**
   * If `true`, the tunnel can be configured remotely from the Zero Trust dashboard.
   * If `false`, the tunnel must be configured locally on the origin machine.
   */
  remote_config?: boolean;

  /**
   * The status of the tunnel. Valid values are `inactive` (tunnel has never been
   * run), `degraded` (tunnel is active and able to serve traffic but in an unhealthy
   * state), `healthy` (tunnel is active and able to serve traffic), or `down`
   * (tunnel can not serve traffic as it has no connections to the Cloudflare Edge).
   */
  status?: 'inactive' | 'degraded' | 'healthy' | 'down';

  /**
   * The type of tunnel.
   */
  tun_type?: 'cfd_tunnel' | 'warp_connector' | 'warp' | 'magic' | 'ip_sec' | 'gre' | 'cni';
}

export namespace CloudflareTunnel {
  export interface Connection {
    /**
     * UUID of the Cloudflare Tunnel connection.
     */
    id?: string;

    /**
     * UUID of the Cloudflare Tunnel connector.
     */
    client_id?: string;

    /**
     * The cloudflared version used to establish this connection.
     */
    client_version?: string;

    /**
     * The Cloudflare data center used for this connection.
     */
    colo_name?: string;

    /**
     * Cloudflare continues to track connections for several minutes after they
     * disconnect. This is an optimization to improve latency and reliability of
     * reconnecting. If `true`, the connection has disconnected but is still being
     * tracked. If `false`, the connection is actively serving traffic.
     */
    is_pending_reconnect?: boolean;

    /**
     * Timestamp of when the connection was established.
     */
    opened_at?: string;

    /**
     * The public IP address of the host running cloudflared.
     */
    origin_ip?: string;

    /**
     * UUID of the Cloudflare Tunnel connection.
     */
    uuid?: string;
  }
}

export interface ErrorData {
  code?: number;

  documentation_url?: string;

  message?: string;

  source?: ErrorData.Source;
}

export namespace ErrorData {
  export interface Source {
    pointer?: string;
  }
}

export interface Identifier {
  /**
   * Identifier.
   */
  id?: string;
}

export interface LoadBalancerPreview {
  /**
   * Monitored pool IDs mapped to their respective names.
   */
  pools?: { [key: string]: string };

  preview_id?: string;
}

export interface Member {
  /**
   * Membership identifier tag.
   */
  id?: string;

  /**
   * Access policy for the membership
   */
  policies?: Array<Member.Policy>;

  /**
   * Roles assigned to this Member.
   */
  roles?: Array<Role>;

  /**
   * A member's status in the account.
   */
  status?: 'accepted' | 'pending';

  /**
   * Details of the user associated to the membership.
   */
  user?: Member.User;
}

export namespace Member {
  export interface Policy {
    /**
     * Policy identifier.
     */
    id?: string;

    /**
     * Allow or deny operations against the resources.
     */
    access?: 'allow' | 'deny';

    /**
     * A set of permission groups that are specified to the policy.
     */
    permission_groups?: Array<Policy.PermissionGroup>;

    /**
     * A list of resource groups that the policy applies to.
     */
    resource_groups?: Array<Policy.ResourceGroup>;
  }

  export namespace Policy {
    /**
     * A named group of permissions that map to a group of operations against
     * resources.
     */
    export interface PermissionGroup {
      /**
       * Identifier of the permission group.
       */
      id: string;

      /**
       * Attributes associated to the permission group.
       */
      meta?: PermissionGroup.Meta;

      /**
       * Name of the permission group.
       */
      name?: string;
    }

    export namespace PermissionGroup {
      /**
       * Attributes associated to the permission group.
       */
      export interface Meta {
        key?: string;

        value?: string;
      }
    }

    /**
     * A group of scoped resources.
     */
    export interface ResourceGroup {
      /**
       * Identifier of the resource group.
       */
      id: string;

      /**
       * The scope associated to the resource group
       */
      scope: Array<ResourceGroup.Scope>;

      /**
       * Attributes associated to the resource group.
       */
      meta?: ResourceGroup.Meta;

      /**
       * Name of the resource group.
       */
      name?: string;
    }

    export namespace ResourceGroup {
      /**
       * A scope is a combination of scope objects which provides additional context.
       */
      export interface Scope {
        /**
         * This is a combination of pre-defined resource name and identifier (like Account
         * ID etc.)
         */
        key: string;

        /**
         * A list of scope objects for additional context.
         */
        objects: Array<Scope.Object>;
      }

      export namespace Scope {
        /**
         * A scope object represents any resource that can have actions applied against
         * invite.
         */
        export interface Object {
          /**
           * This is a combination of pre-defined resource name and identifier (like Zone ID
           * etc.)
           */
          key: string;
        }
      }

      /**
       * Attributes associated to the resource group.
       */
      export interface Meta {
        key?: string;

        value?: string;
      }
    }
  }

  /**
   * Details of the user associated to the membership.
   */
  export interface User {
    /**
     * The contact email address of the user.
     */
    email: string;

    /**
     * Identifier
     */
    id?: string;

    /**
     * User's first name
     */
    first_name?: string | null;

    /**
     * User's last name
     */
    last_name?: string | null;

    /**
     * Indicates whether two-factor authentication is enabled for the user account.
     * Does not apply to API authentication.
     */
    two_factor_authentication_enabled?: boolean;
  }
}

export interface PaginationInfo {
  /**
   * Total number of results for the requested service
   */
  count?: number;

  /**
   * Current page within paginated list of results
   */
  page?: number;

  /**
   * Number of results per page of results
   */
  per_page?: number;

  /**
   * Total results available without any search parameters
   */
  total_count?: number;
}

export type Permission = string;

export interface PermissionGrant {
  read?: boolean;

  write?: boolean;
}

export interface PermissionGrantParam {
  read?: boolean;

  write?: boolean;
}

/**
 * The rate plan applied to the subscription.
 */
export interface RatePlan {
  /**
   * The ID of the rate plan.
   */
  id?:
    | 'free'
    | 'lite'
    | 'pro'
    | 'pro_plus'
    | 'business'
    | 'enterprise'
    | 'partners_free'
    | 'partners_pro'
    | 'partners_business'
    | 'partners_enterprise';

  /**
   * The currency applied to the rate plan subscription.
   */
  currency?: string;

  /**
   * Whether this rate plan is managed externally from Cloudflare.
   */
  externally_managed?: boolean;

  /**
   * Whether a rate plan is enterprise-based (or newly adopted term contract).
   */
  is_contract?: boolean;

  /**
   * The full name of the rate plan.
   */
  public_name?: string;

  /**
   * The scope that this rate plan applies to.
   */
  scope?: string;

  /**
   * The list of sets this rate plan applies to.
   */
  sets?: Array<string>;
}

/**
 * The rate plan applied to the subscription.
 */
export interface RatePlanParam {
  /**
   * The ID of the rate plan.
   */
  id?:
    | 'free'
    | 'lite'
    | 'pro'
    | 'pro_plus'
    | 'business'
    | 'enterprise'
    | 'partners_free'
    | 'partners_pro'
    | 'partners_business'
    | 'partners_enterprise';

  /**
   * The currency applied to the rate plan subscription.
   */
  currency?: string;

  /**
   * Whether this rate plan is managed externally from Cloudflare.
   */
  externally_managed?: boolean;

  /**
   * Whether a rate plan is enterprise-based (or newly adopted term contract).
   */
  is_contract?: boolean;

  /**
   * The full name of the rate plan.
   */
  public_name?: string;

  /**
   * The scope that this rate plan applies to.
   */
  scope?: string;

  /**
   * The list of sets this rate plan applies to.
   */
  sets?: Array<string>;
}

export interface ResponseInfo {
  code: number;

  message: string;

  documentation_url?: string;

  source?: ResponseInfo.Source;
}

export namespace ResponseInfo {
  export interface Source {
    pointer?: string;
  }
}

export type Result = Result.UnionMember0 | Result.AaaAPIResponseCommon;

export namespace Result {
  export interface UnionMember0 {
    errors?: Array<Shared.ResponseInfo>;

    messages?: Array<Shared.ResponseInfo>;

    result?: Array<Shared.AuditLog>;

    success?: boolean;
  }

  export interface AaaAPIResponseCommon {
    errors: Array<Shared.ResponseInfo>;

    messages: Array<Shared.ResponseInfo>;

    /**
     * Whether the API call was successful
     */
    success: true;
  }
}

export interface Role {
  /**
   * Role identifier tag.
   */
  id: string;

  /**
   * Description of role's permissions.
   */
  description: string;

  /**
   * Role name.
   */
  name: string;

  permissions: Role.Permissions;
}

export namespace Role {
  export interface Permissions {
    analytics?: Shared.PermissionGrant;

    billing?: Shared.PermissionGrant;

    cache_purge?: Shared.PermissionGrant;

    dns?: Shared.PermissionGrant;

    dns_records?: Shared.PermissionGrant;

    lb?: Shared.PermissionGrant;

    logs?: Shared.PermissionGrant;

    organization?: Shared.PermissionGrant;

    ssl?: Shared.PermissionGrant;

    waf?: Shared.PermissionGrant;

    zone_settings?: Shared.PermissionGrant;

    zones?: Shared.PermissionGrant;
  }
}

export interface RoleParam {
  /**
   * Role identifier tag.
   */
  id: string;
}

/**
 * Direction to order DNS records in.
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Direction to order DNS records in.
 */
export type SortDirectionParam = 'asc' | 'desc';

export interface Subscription {
  /**
   * Subscription identifier tag.
   */
  id?: string;

  /**
   * The monetary unit in which pricing information is displayed.
   */
  currency?: string;

  /**
   * The end of the current period and also when the next billing is due.
   */
  current_period_end?: string;

  /**
   * When the current billing period started. May match initial_period_start if this
   * is the first period.
   */
  current_period_start?: string;

  /**
   * How often the subscription is renewed automatically.
   */
  frequency?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';

  /**
   * The price of the subscription that will be billed, in US dollars.
   */
  price?: number;

  /**
   * The rate plan applied to the subscription.
   */
  rate_plan?: RatePlan;

  /**
   * The state that the subscription is in.
   */
  state?: 'Trial' | 'Provisioned' | 'Paid' | 'AwaitingPayment' | 'Cancelled' | 'Failed' | 'Expired';
}

/**
 * A component value for a subscription.
 */
export interface SubscriptionComponent {
  /**
   * The default amount assigned.
   */
  default?: number;

  /**
   * The name of the component value.
   */
  name?: string;

  /**
   * The unit price for the component value.
   */
  price?: number;

  /**
   * The amount of the component value assigned.
   */
  value?: number;
}

/**
 * A simple zone object. May have null properties if not a zone subscription.
 */
export interface SubscriptionZone {
  /**
   * Identifier
   */
  id?: string;

  /**
   * The domain name
   */
  name?: string;
}

export interface Token {
  /**
   * Token identifier tag.
   */
  id?: string;

  condition?: Token.Condition;

  /**
   * The expiration time on or after which the JWT MUST NOT be accepted for
   * processing.
   */
  expires_on?: string;

  /**
   * The time on which the token was created.
   */
  issued_on?: string;

  /**
   * Last time the token was used.
   */
  last_used_on?: string;

  /**
   * Last time the token was modified.
   */
  modified_on?: string;

  /**
   * Token name.
   */
  name?: string;

  /**
   * The time before which the token MUST NOT be accepted for processing.
   */
  not_before?: string;

  /**
   * List of access policies assigned to the token.
   */
  policies?: Array<TokenPolicy>;

  /**
   * Status of the token.
   */
  status?: 'active' | 'disabled' | 'expired';
}

export namespace Token {
  export interface Condition {
    /**
     * Client IP restrictions.
     */
    request_ip?: Condition.RequestIP;
  }

  export namespace Condition {
    /**
     * Client IP restrictions.
     */
    export interface RequestIP {
      /**
       * List of IPv4/IPv6 CIDR addresses.
       */
      in?: Array<Shared.TokenConditionCIDRList>;

      /**
       * List of IPv4/IPv6 CIDR addresses.
       */
      not_in?: Array<Shared.TokenConditionCIDRList>;
    }
  }
}

/**
 * IPv4/IPv6 CIDR.
 */
export type TokenConditionCIDRList = string;

/**
 * IPv4/IPv6 CIDR.
 */
export type TokenConditionCIDRListParam = string;

export interface TokenPolicy {
  /**
   * Policy identifier.
   */
  id: string;

  /**
   * Allow or deny operations against the resources.
   */
  effect: 'allow' | 'deny';

  /**
   * A set of permission groups that are specified to the policy.
   */
  permission_groups: Array<TokenPolicy.PermissionGroup>;

  /**
   * A list of resource names that the policy applies to.
   */
  resources: { [key: string]: string | { [key: string]: string } };
}

export namespace TokenPolicy {
  /**
   * A named group of permissions that map to a group of operations against
   * resources.
   */
  export interface PermissionGroup {
    /**
     * Identifier of the permission group.
     */
    id: string;

    /**
     * Attributes associated to the permission group.
     */
    meta?: PermissionGroup.Meta;

    /**
     * Name of the permission group.
     */
    name?: string;
  }

  export namespace PermissionGroup {
    /**
     * Attributes associated to the permission group.
     */
    export interface Meta {
      key?: string;

      value?: string;
    }
  }
}

export interface TokenPolicyParam {
  /**
   * Allow or deny operations against the resources.
   */
  effect: 'allow' | 'deny';

  /**
   * A set of permission groups that are specified to the policy.
   */
  permission_groups: Array<TokenPolicyParam.PermissionGroup>;

  /**
   * A list of resource names that the policy applies to.
   */
  resources: { [key: string]: string | { [key: string]: string } };
}

export namespace TokenPolicyParam {
  /**
   * A named group of permissions that map to a group of operations against
   * resources.
   */
  export interface PermissionGroup {
    /**
     * Identifier of the permission group.
     */
    id: string;

    /**
     * Attributes associated to the permission group.
     */
    meta?: PermissionGroup.Meta;
  }

  export namespace PermissionGroup {
    /**
     * Attributes associated to the permission group.
     */
    export interface Meta {
      key?: string;

      value?: string;
    }
  }
}

/**
 * The token value.
 */
export type TokenValue = string;

export class MembersV4PagePaginationArray extends V4PagePaginationArray<Member> {}

export class RolesV4PagePaginationArray extends V4PagePaginationArray<Role> {}

export class SubscriptionsSinglePage extends SinglePage<Subscription> {}

export class TokensV4PagePaginationArray extends V4PagePaginationArray<Token> {}

export class AuditLogsV4PagePaginationArray extends V4PagePaginationArray<AuditLog> {}
