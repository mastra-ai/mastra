// File generated from our OpenAPI spec by Stainless. See CONTRIBUTING.md for details.

import { APIResource } from '../../../resource';
import * as Core from '../../../core';
import * as RulesAPI from './rules';
import { SinglePage } from '../../../pagination';

export class Rules extends APIResource {
  /**
   * Creates a new Zero Trust Gateway rule.
   *
   * @example
   * ```ts
   * const gatewayRule =
   *   await client.zeroTrust.gateway.rules.create({
   *     account_id: '699d98642c564d2e855e9661899b7252',
   *     action: 'allow',
   *     name: 'block bad websites',
   *   });
   * ```
   */
  create(params: RuleCreateParams, options?: Core.RequestOptions): Core.APIPromise<GatewayRule> {
    const { account_id, ...body } = params;
    return (
      this._client.post(`/accounts/${account_id}/gateway/rules`, { body, ...options }) as Core.APIPromise<{
        result: GatewayRule;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Updates a configured Zero Trust Gateway rule.
   *
   * @example
   * ```ts
   * const gatewayRule =
   *   await client.zeroTrust.gateway.rules.update(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     {
   *       account_id: '699d98642c564d2e855e9661899b7252',
   *       action: 'allow',
   *       name: 'block bad websites',
   *     },
   *   );
   * ```
   */
  update(
    ruleId: string,
    params: RuleUpdateParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewayRule> {
    const { account_id, ...body } = params;
    return (
      this._client.put(`/accounts/${account_id}/gateway/rules/${ruleId}`, {
        body,
        ...options,
      }) as Core.APIPromise<{ result: GatewayRule }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches the Zero Trust Gateway rules for an account.
   *
   * @example
   * ```ts
   * // Automatically fetches more pages as needed.
   * for await (const gatewayRule of client.zeroTrust.gateway.rules.list(
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * )) {
   *   // ...
   * }
   * ```
   */
  list(
    params: RuleListParams,
    options?: Core.RequestOptions,
  ): Core.PagePromise<GatewayRulesSinglePage, GatewayRule> {
    const { account_id } = params;
    return this._client.getAPIList(`/accounts/${account_id}/gateway/rules`, GatewayRulesSinglePage, options);
  }

  /**
   * Deletes a Zero Trust Gateway rule.
   *
   * @example
   * ```ts
   * const rule = await client.zeroTrust.gateway.rules.delete(
   *   'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *   { account_id: '699d98642c564d2e855e9661899b7252' },
   * );
   * ```
   */
  delete(
    ruleId: string,
    params: RuleDeleteParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<RuleDeleteResponse> {
    const { account_id } = params;
    return (
      this._client.delete(`/accounts/${account_id}/gateway/rules/${ruleId}`, options) as Core.APIPromise<{
        result: RuleDeleteResponse;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Fetches a single Zero Trust Gateway rule.
   *
   * @example
   * ```ts
   * const gatewayRule =
   *   await client.zeroTrust.gateway.rules.get(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  get(ruleId: string, params: RuleGetParams, options?: Core.RequestOptions): Core.APIPromise<GatewayRule> {
    const { account_id } = params;
    return (
      this._client.get(`/accounts/${account_id}/gateway/rules/${ruleId}`, options) as Core.APIPromise<{
        result: GatewayRule;
      }>
    )._thenUnwrap((obj) => obj.result);
  }

  /**
   * Resets the expiration of a Zero Trust Gateway Rule if its duration has elapsed
   * and it has a default duration.
   *
   * The Zero Trust Gateway Rule must have values for both `expiration.expires_at`
   * and `expiration.duration`.
   *
   * @example
   * ```ts
   * const gatewayRule =
   *   await client.zeroTrust.gateway.rules.resetExpiration(
   *     'f174e90a-fafe-4643-bbbc-4a0ed4fc8415',
   *     { account_id: '699d98642c564d2e855e9661899b7252' },
   *   );
   * ```
   */
  resetExpiration(
    ruleId: string,
    params: RuleResetExpirationParams,
    options?: Core.RequestOptions,
  ): Core.APIPromise<GatewayRule> {
    const { account_id } = params;
    return (
      this._client.post(
        `/accounts/${account_id}/gateway/rules/${ruleId}/reset_expiration`,
        options,
      ) as Core.APIPromise<{ result: GatewayRule }>
    )._thenUnwrap((obj) => obj.result);
  }
}

export class GatewayRulesSinglePage extends SinglePage<GatewayRule> {}

export interface DNSResolverSettingsV4 {
  /**
   * IPv4 address of upstream resolver.
   */
  ip: string;

  /**
   * A port number to use for upstream resolver. Defaults to 53 if unspecified.
   */
  port?: number;

  /**
   * Whether to connect to this resolver over a private network. Must be set when
   * vnet_id is set.
   */
  route_through_private_network?: boolean;

  /**
   * Optionally specify a virtual network for this resolver. Uses default virtual
   * network id if omitted.
   */
  vnet_id?: string;
}

export interface DNSResolverSettingsV4Param {
  /**
   * IPv4 address of upstream resolver.
   */
  ip: string;

  /**
   * A port number to use for upstream resolver. Defaults to 53 if unspecified.
   */
  port?: number;

  /**
   * Whether to connect to this resolver over a private network. Must be set when
   * vnet_id is set.
   */
  route_through_private_network?: boolean;

  /**
   * Optionally specify a virtual network for this resolver. Uses default virtual
   * network id if omitted.
   */
  vnet_id?: string;
}

export interface DNSResolverSettingsV6 {
  /**
   * IPv6 address of upstream resolver.
   */
  ip: string;

  /**
   * A port number to use for upstream resolver. Defaults to 53 if unspecified.
   */
  port?: number;

  /**
   * Whether to connect to this resolver over a private network. Must be set when
   * vnet_id is set.
   */
  route_through_private_network?: boolean;

  /**
   * Optionally specify a virtual network for this resolver. Uses default virtual
   * network id if omitted.
   */
  vnet_id?: string;
}

export interface DNSResolverSettingsV6Param {
  /**
   * IPv6 address of upstream resolver.
   */
  ip: string;

  /**
   * A port number to use for upstream resolver. Defaults to 53 if unspecified.
   */
  port?: number;

  /**
   * Whether to connect to this resolver over a private network. Must be set when
   * vnet_id is set.
   */
  route_through_private_network?: boolean;

  /**
   * Optionally specify a virtual network for this resolver. Uses default virtual
   * network id if omitted.
   */
  vnet_id?: string;
}

/**
 * The protocol or layer to use.
 */
export type GatewayFilter = 'http' | 'dns' | 'l4' | 'egress' | 'dns_resolver';

/**
 * The protocol or layer to use.
 */
export type GatewayFilterParam = 'http' | 'dns' | 'l4' | 'egress' | 'dns_resolver';

export interface GatewayRule {
  /**
   * The API resource UUID.
   */
  id?: string;

  /**
   * The action to preform when the associated traffic, identity, and device posture
   * expressions are either absent or evaluate to `true`.
   */
  action?:
    | 'on'
    | 'off'
    | 'allow'
    | 'block'
    | 'scan'
    | 'noscan'
    | 'safesearch'
    | 'ytrestricted'
    | 'isolate'
    | 'noisolate'
    | 'override'
    | 'l4_override'
    | 'egress'
    | 'resolve'
    | 'quarantine'
    | 'redirect';

  created_at?: string;

  /**
   * Date of deletion, if any.
   */
  deleted_at?: string | null;

  /**
   * The description of the rule.
   */
  description?: string;

  /**
   * The wirefilter expression used for device posture check matching.
   */
  device_posture?: string;

  /**
   * True if the rule is enabled.
   */
  enabled?: boolean;

  /**
   * The expiration time stamp and default duration of a DNS policy. Takes precedence
   * over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  expiration?: GatewayRule.Expiration | null;

  /**
   * The protocol or layer to evaluate the traffic, identity, and device posture
   * expressions.
   */
  filters?: Array<GatewayFilter>;

  /**
   * The wirefilter expression used for identity matching.
   */
  identity?: string;

  /**
   * The name of the rule.
   */
  name?: string;

  /**
   * Precedence sets the order of your rules. Lower values indicate higher
   * precedence. At each processing phase, applicable rules are evaluated in
   * ascending order of this value. Refer to
   * [Order of enforcement](http://developers.cloudflare.com/learning-paths/secure-internet-traffic/understand-policies/order-of-enforcement/#manage-precedence-with-terraform)
   * docs on how to manage precedence via Terraform.
   */
  precedence?: number;

  /**
   * Additional settings that modify the rule's action.
   */
  rule_settings?: RuleSetting;

  /**
   * The schedule for activating DNS policies. This does not apply to HTTP or network
   * policies.
   */
  schedule?: Schedule | null;

  /**
   * The wirefilter expression used for traffic matching.
   */
  traffic?: string;

  updated_at?: string;

  /**
   * version number of the rule
   */
  version?: number;

  /**
   * Warning for a misconfigured rule, if any.
   */
  warning_status?: string | null;
}

export namespace GatewayRule {
  /**
   * The expiration time stamp and default duration of a DNS policy. Takes precedence
   * over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  export interface Expiration {
    /**
     * The time stamp at which the policy will expire and cease to be applied.
     *
     * Must adhere to RFC 3339 and include a UTC offset. Non-zero offsets are accepted
     * but will be converted to the equivalent value with offset zero (UTC+00:00) and
     * will be returned as time stamps with offset zero denoted by a trailing 'Z'.
     *
     * Policies with an expiration do not consider the timezone of clients they are
     * applied to, and expire "globally" at the point given by their `expires_at`
     * value.
     */
    expires_at: string;

    /**
     * The default duration a policy will be active in minutes. Must be set in order to
     * use the `reset_expiration` endpoint on this rule.
     */
    duration?: number;

    /**
     * Whether the policy has expired.
     */
    expired?: boolean;
  }
}

/**
 * Additional settings that modify the rule's action.
 */
export interface RuleSetting {
  /**
   * Add custom headers to allowed requests, in the form of key-value pairs. Keys are
   * header names, pointing to an array with its header value(s).
   */
  add_headers?: { [key: string]: string } | null;

  /**
   * Set by parent MSP accounts to enable their children to bypass this rule.
   */
  allow_child_bypass?: boolean | null;

  /**
   * Settings for the Audit SSH action.
   */
  audit_ssh?: RuleSetting.AuditSSH | null;

  /**
   * Configure how browser isolation behaves.
   */
  biso_admin_controls?: RuleSetting.BISOAdminControls | null;

  /**
   * Custom block page settings. If missing/null, blocking will use the the account
   * settings.
   */
  block_page?: RuleSetting.BlockPage | null;

  /**
   * Enable the custom block page.
   */
  block_page_enabled?: boolean;

  /**
   * The text describing why this block occurred, displayed on the custom block page
   * (if enabled).
   */
  block_reason?: string;

  /**
   * Set by children MSP accounts to bypass their parent's rules.
   */
  bypass_parent_rule?: boolean | null;

  /**
   * Configure how session check behaves.
   */
  check_session?: RuleSetting.CheckSession | null;

  /**
   * Add your own custom resolvers to route queries that match the resolver policy.
   * Cannot be used when 'resolve_dns_through_cloudflare' or 'resolve_dns_internally'
   * are set. DNS queries will route to the address closest to their origin. Only
   * valid when a rule's action is set to 'resolve'.
   */
  dns_resolvers?: RuleSetting.DNSResolvers | null;

  /**
   * Configure how Gateway Proxy traffic egresses. You can enable this setting for
   * rules with Egress actions and filters, or omit it to indicate local egress via
   * WARP IPs.
   */
  egress?: RuleSetting.Egress | null;

  /**
   * Set to true, to ignore the category matches at CNAME domains in a response. If
   * unchecked, the categories in this rule will be checked against all the CNAME
   * domain categories in a response.
   */
  ignore_cname_category_matches?: boolean;

  /**
   * INSECURE - disable DNSSEC validation (for Allow actions).
   */
  insecure_disable_dnssec_validation?: boolean;

  /**
   * Set to true to enable IPs in DNS resolver category blocks. By default categories
   * only block based on domain names.
   */
  ip_categories?: boolean;

  /**
   * Set to true to include IPs in DNS resolver indicator feed blocks. By default
   * indicator feeds only block based on domain names.
   */
  ip_indicator_feeds?: boolean;

  /**
   * Send matching traffic to the supplied destination IP address and port.
   */
  l4override?: RuleSetting.L4override | null;

  /**
   * Configure a notification to display on the user's device when this rule is
   * matched.
   */
  notification_settings?: RuleSetting.NotificationSettings | null;

  /**
   * Override matching DNS queries with a hostname.
   */
  override_host?: string;

  /**
   * Override matching DNS queries with an IP or set of IPs.
   */
  override_ips?: Array<string> | null;

  /**
   * Configure DLP payload logging.
   */
  payload_log?: RuleSetting.PayloadLog | null;

  /**
   * Settings that apply to quarantine rules
   */
  quarantine?: RuleSetting.Quarantine | null;

  /**
   * Settings that apply to redirect rules
   */
  redirect?: RuleSetting.Redirect | null;

  /**
   * Configure to forward the query to the internal DNS service, passing the
   * specified 'view_id' as input. Cannot be set when 'dns_resolvers' are specified
   * or 'resolve_dns_through_cloudflare' is set. Only valid when a rule's action is
   * set to 'resolve'.
   */
  resolve_dns_internally?: RuleSetting.ResolveDNSInternally | null;

  /**
   * Enable to send queries that match the policy to Cloudflare's default 1.1.1.1 DNS
   * resolver. Cannot be set when 'dns_resolvers' are specified or
   * 'resolve_dns_internally' is set. Only valid when a rule's action is set to
   * 'resolve'.
   */
  resolve_dns_through_cloudflare?: boolean | null;

  /**
   * Configure behavior when an upstream cert is invalid or an SSL error occurs.
   */
  untrusted_cert?: RuleSetting.UntrustedCERT | null;
}

export namespace RuleSetting {
  /**
   * Settings for the Audit SSH action.
   */
  export interface AuditSSH {
    /**
     * Enable to turn on SSH command logging.
     */
    command_logging?: boolean;
  }

  /**
   * Configure how browser isolation behaves.
   */
  export interface BISOAdminControls {
    /**
     * Configure whether copy is enabled or not. When set with "remote_only", copying
     * isolated content from the remote browser to the user's local clipboard is
     * disabled. When absent, copy is enabled. Only applies when `version == "v2"`.
     */
    copy?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Set to false to enable copy-pasting. Only applies when `version == "v1"`.
     */
    dcp?: boolean;

    /**
     * Set to false to enable downloading. Only applies when `version == "v1"`.
     */
    dd?: boolean;

    /**
     * Set to false to enable keyboard usage. Only applies when `version == "v1"`.
     */
    dk?: boolean;

    /**
     * Configure whether downloading enabled or not. When set with "remote_only",
     * downloads are only available for viewing. Only applies when `version == "v2"`.
     */
    download?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Set to false to enable printing. Only applies when `version == "v1"`.
     */
    dp?: boolean;

    /**
     * Set to false to enable uploading. Only applies when `version == "v1"`.
     */
    du?: boolean;

    /**
     * Configure whether keyboard usage is enabled or not. When absent, keyboard usage
     * is enabled. Only applies when `version == "v2"`.
     */
    keyboard?: 'enabled' | 'disabled';

    /**
     * Configure whether pasting is enabled or not. When set with "remote_only",
     * pasting content from the user's local clipboard into isolated pages is disabled.
     * When absent, paste is enabled. Only applies when `version == "v2"`.
     */
    paste?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Configure whether printing is enabled or not. When absent, printing is enabled.
     * Only applies when `version == "v2"`.
     */
    printing?: 'enabled' | 'disabled';

    /**
     * Configure whether uploading is enabled or not. When absent, uploading is
     * enabled. Only applies when `version == "v2"`.
     */
    upload?: 'enabled' | 'disabled';

    /**
     * Indicates which version of the browser isolation controls should apply.
     */
    version?: 'v1' | 'v2';
  }

  /**
   * Custom block page settings. If missing/null, blocking will use the the account
   * settings.
   */
  export interface BlockPage {
    /**
     * URI to which the user will be redirected
     */
    target_uri: string;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;
  }

  /**
   * Configure how session check behaves.
   */
  export interface CheckSession {
    /**
     * Configure how fresh the session needs to be to be considered valid.
     */
    duration?: string;

    /**
     * Set to true to enable session enforcement.
     */
    enforce?: boolean;
  }

  /**
   * Add your own custom resolvers to route queries that match the resolver policy.
   * Cannot be used when 'resolve_dns_through_cloudflare' or 'resolve_dns_internally'
   * are set. DNS queries will route to the address closest to their origin. Only
   * valid when a rule's action is set to 'resolve'.
   */
  export interface DNSResolvers {
    ipv4?: Array<RulesAPI.DNSResolverSettingsV4>;

    ipv6?: Array<RulesAPI.DNSResolverSettingsV6>;
  }

  /**
   * Configure how Gateway Proxy traffic egresses. You can enable this setting for
   * rules with Egress actions and filters, or omit it to indicate local egress via
   * WARP IPs.
   */
  export interface Egress {
    /**
     * The IPv4 address to be used for egress.
     */
    ipv4?: string;

    /**
     * The fallback IPv4 address to be used for egress in the event of an error
     * egressing with the primary IPv4. Can be '0.0.0.0' to indicate local egress via
     * WARP IPs.
     */
    ipv4_fallback?: string;

    /**
     * The IPv6 range to be used for egress.
     */
    ipv6?: string;
  }

  /**
   * Send matching traffic to the supplied destination IP address and port.
   */
  export interface L4override {
    /**
     * IPv4 or IPv6 address.
     */
    ip?: string;

    /**
     * A port number to use for TCP/UDP overrides.
     */
    port?: number;
  }

  /**
   * Configure a notification to display on the user's device when this rule is
   * matched.
   */
  export interface NotificationSettings {
    /**
     * Set notification on
     */
    enabled?: boolean;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;

    /**
     * Customize the message shown in the notification.
     */
    msg?: string;

    /**
     * Optional URL to direct users to additional information. If not set, the
     * notification will open a block page.
     */
    support_url?: string;
  }

  /**
   * Configure DLP payload logging.
   */
  export interface PayloadLog {
    /**
     * Set to true to enable DLP payload logging for this rule.
     */
    enabled?: boolean;
  }

  /**
   * Settings that apply to quarantine rules
   */
  export interface Quarantine {
    /**
     * Types of files to sandbox.
     */
    file_types?: Array<
      | 'exe'
      | 'pdf'
      | 'doc'
      | 'docm'
      | 'docx'
      | 'rtf'
      | 'ppt'
      | 'pptx'
      | 'xls'
      | 'xlsm'
      | 'xlsx'
      | 'zip'
      | 'rar'
    >;
  }

  /**
   * Settings that apply to redirect rules
   */
  export interface Redirect {
    /**
     * URI to which the user will be redirected
     */
    target_uri: string;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;

    /**
     * If true, the path and query parameters from the original request will be
     * appended to target_uri
     */
    preserve_path_and_query?: boolean;
  }

  /**
   * Configure to forward the query to the internal DNS service, passing the
   * specified 'view_id' as input. Cannot be set when 'dns_resolvers' are specified
   * or 'resolve_dns_through_cloudflare' is set. Only valid when a rule's action is
   * set to 'resolve'.
   */
  export interface ResolveDNSInternally {
    /**
     * The fallback behavior to apply when the internal DNS response code is different
     * from 'NOERROR' or when the response data only contains CNAME records for 'A' or
     * 'AAAA' queries.
     */
    fallback?: 'none' | 'public_dns';

    /**
     * The internal DNS view identifier that's passed to the internal DNS service.
     */
    view_id?: string;
  }

  /**
   * Configure behavior when an upstream cert is invalid or an SSL error occurs.
   */
  export interface UntrustedCERT {
    /**
     * The action performed when an untrusted certificate is seen. The default action
     * is an error with HTTP code 526.
     */
    action?: 'pass_through' | 'block' | 'error';
  }
}

/**
 * Additional settings that modify the rule's action.
 */
export interface RuleSettingParam {
  /**
   * Add custom headers to allowed requests, in the form of key-value pairs. Keys are
   * header names, pointing to an array with its header value(s).
   */
  add_headers?: { [key: string]: string } | null;

  /**
   * Set by parent MSP accounts to enable their children to bypass this rule.
   */
  allow_child_bypass?: boolean | null;

  /**
   * Settings for the Audit SSH action.
   */
  audit_ssh?: RuleSettingParam.AuditSSH | null;

  /**
   * Configure how browser isolation behaves.
   */
  biso_admin_controls?: RuleSettingParam.BISOAdminControls | null;

  /**
   * Custom block page settings. If missing/null, blocking will use the the account
   * settings.
   */
  block_page?: RuleSettingParam.BlockPage | null;

  /**
   * Enable the custom block page.
   */
  block_page_enabled?: boolean;

  /**
   * The text describing why this block occurred, displayed on the custom block page
   * (if enabled).
   */
  block_reason?: string;

  /**
   * Set by children MSP accounts to bypass their parent's rules.
   */
  bypass_parent_rule?: boolean | null;

  /**
   * Configure how session check behaves.
   */
  check_session?: RuleSettingParam.CheckSession | null;

  /**
   * Add your own custom resolvers to route queries that match the resolver policy.
   * Cannot be used when 'resolve_dns_through_cloudflare' or 'resolve_dns_internally'
   * are set. DNS queries will route to the address closest to their origin. Only
   * valid when a rule's action is set to 'resolve'.
   */
  dns_resolvers?: RuleSettingParam.DNSResolvers | null;

  /**
   * Configure how Gateway Proxy traffic egresses. You can enable this setting for
   * rules with Egress actions and filters, or omit it to indicate local egress via
   * WARP IPs.
   */
  egress?: RuleSettingParam.Egress | null;

  /**
   * Set to true, to ignore the category matches at CNAME domains in a response. If
   * unchecked, the categories in this rule will be checked against all the CNAME
   * domain categories in a response.
   */
  ignore_cname_category_matches?: boolean;

  /**
   * INSECURE - disable DNSSEC validation (for Allow actions).
   */
  insecure_disable_dnssec_validation?: boolean;

  /**
   * Set to true to enable IPs in DNS resolver category blocks. By default categories
   * only block based on domain names.
   */
  ip_categories?: boolean;

  /**
   * Set to true to include IPs in DNS resolver indicator feed blocks. By default
   * indicator feeds only block based on domain names.
   */
  ip_indicator_feeds?: boolean;

  /**
   * Send matching traffic to the supplied destination IP address and port.
   */
  l4override?: RuleSettingParam.L4override | null;

  /**
   * Configure a notification to display on the user's device when this rule is
   * matched.
   */
  notification_settings?: RuleSettingParam.NotificationSettings | null;

  /**
   * Override matching DNS queries with a hostname.
   */
  override_host?: string;

  /**
   * Override matching DNS queries with an IP or set of IPs.
   */
  override_ips?: Array<string> | null;

  /**
   * Configure DLP payload logging.
   */
  payload_log?: RuleSettingParam.PayloadLog | null;

  /**
   * Settings that apply to quarantine rules
   */
  quarantine?: RuleSettingParam.Quarantine | null;

  /**
   * Settings that apply to redirect rules
   */
  redirect?: RuleSettingParam.Redirect | null;

  /**
   * Configure to forward the query to the internal DNS service, passing the
   * specified 'view_id' as input. Cannot be set when 'dns_resolvers' are specified
   * or 'resolve_dns_through_cloudflare' is set. Only valid when a rule's action is
   * set to 'resolve'.
   */
  resolve_dns_internally?: RuleSettingParam.ResolveDNSInternally | null;

  /**
   * Enable to send queries that match the policy to Cloudflare's default 1.1.1.1 DNS
   * resolver. Cannot be set when 'dns_resolvers' are specified or
   * 'resolve_dns_internally' is set. Only valid when a rule's action is set to
   * 'resolve'.
   */
  resolve_dns_through_cloudflare?: boolean | null;

  /**
   * Configure behavior when an upstream cert is invalid or an SSL error occurs.
   */
  untrusted_cert?: RuleSettingParam.UntrustedCERT | null;
}

export namespace RuleSettingParam {
  /**
   * Settings for the Audit SSH action.
   */
  export interface AuditSSH {
    /**
     * Enable to turn on SSH command logging.
     */
    command_logging?: boolean;
  }

  /**
   * Configure how browser isolation behaves.
   */
  export interface BISOAdminControls {
    /**
     * Configure whether copy is enabled or not. When set with "remote_only", copying
     * isolated content from the remote browser to the user's local clipboard is
     * disabled. When absent, copy is enabled. Only applies when `version == "v2"`.
     */
    copy?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Set to false to enable copy-pasting. Only applies when `version == "v1"`.
     */
    dcp?: boolean;

    /**
     * Set to false to enable downloading. Only applies when `version == "v1"`.
     */
    dd?: boolean;

    /**
     * Set to false to enable keyboard usage. Only applies when `version == "v1"`.
     */
    dk?: boolean;

    /**
     * Configure whether downloading enabled or not. When set with "remote_only",
     * downloads are only available for viewing. Only applies when `version == "v2"`.
     */
    download?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Set to false to enable printing. Only applies when `version == "v1"`.
     */
    dp?: boolean;

    /**
     * Set to false to enable uploading. Only applies when `version == "v1"`.
     */
    du?: boolean;

    /**
     * Configure whether keyboard usage is enabled or not. When absent, keyboard usage
     * is enabled. Only applies when `version == "v2"`.
     */
    keyboard?: 'enabled' | 'disabled';

    /**
     * Configure whether pasting is enabled or not. When set with "remote_only",
     * pasting content from the user's local clipboard into isolated pages is disabled.
     * When absent, paste is enabled. Only applies when `version == "v2"`.
     */
    paste?: 'enabled' | 'disabled' | 'remote_only';

    /**
     * Configure whether printing is enabled or not. When absent, printing is enabled.
     * Only applies when `version == "v2"`.
     */
    printing?: 'enabled' | 'disabled';

    /**
     * Configure whether uploading is enabled or not. When absent, uploading is
     * enabled. Only applies when `version == "v2"`.
     */
    upload?: 'enabled' | 'disabled';

    /**
     * Indicates which version of the browser isolation controls should apply.
     */
    version?: 'v1' | 'v2';
  }

  /**
   * Custom block page settings. If missing/null, blocking will use the the account
   * settings.
   */
  export interface BlockPage {
    /**
     * URI to which the user will be redirected
     */
    target_uri: string;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;
  }

  /**
   * Configure how session check behaves.
   */
  export interface CheckSession {
    /**
     * Configure how fresh the session needs to be to be considered valid.
     */
    duration?: string;

    /**
     * Set to true to enable session enforcement.
     */
    enforce?: boolean;
  }

  /**
   * Add your own custom resolvers to route queries that match the resolver policy.
   * Cannot be used when 'resolve_dns_through_cloudflare' or 'resolve_dns_internally'
   * are set. DNS queries will route to the address closest to their origin. Only
   * valid when a rule's action is set to 'resolve'.
   */
  export interface DNSResolvers {
    ipv4?: Array<RulesAPI.DNSResolverSettingsV4Param>;

    ipv6?: Array<RulesAPI.DNSResolverSettingsV6Param>;
  }

  /**
   * Configure how Gateway Proxy traffic egresses. You can enable this setting for
   * rules with Egress actions and filters, or omit it to indicate local egress via
   * WARP IPs.
   */
  export interface Egress {
    /**
     * The IPv4 address to be used for egress.
     */
    ipv4?: string;

    /**
     * The fallback IPv4 address to be used for egress in the event of an error
     * egressing with the primary IPv4. Can be '0.0.0.0' to indicate local egress via
     * WARP IPs.
     */
    ipv4_fallback?: string;

    /**
     * The IPv6 range to be used for egress.
     */
    ipv6?: string;
  }

  /**
   * Send matching traffic to the supplied destination IP address and port.
   */
  export interface L4override {
    /**
     * IPv4 or IPv6 address.
     */
    ip?: string;

    /**
     * A port number to use for TCP/UDP overrides.
     */
    port?: number;
  }

  /**
   * Configure a notification to display on the user's device when this rule is
   * matched.
   */
  export interface NotificationSettings {
    /**
     * Set notification on
     */
    enabled?: boolean;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;

    /**
     * Customize the message shown in the notification.
     */
    msg?: string;

    /**
     * Optional URL to direct users to additional information. If not set, the
     * notification will open a block page.
     */
    support_url?: string;
  }

  /**
   * Configure DLP payload logging.
   */
  export interface PayloadLog {
    /**
     * Set to true to enable DLP payload logging for this rule.
     */
    enabled?: boolean;
  }

  /**
   * Settings that apply to quarantine rules
   */
  export interface Quarantine {
    /**
     * Types of files to sandbox.
     */
    file_types?: Array<
      | 'exe'
      | 'pdf'
      | 'doc'
      | 'docm'
      | 'docx'
      | 'rtf'
      | 'ppt'
      | 'pptx'
      | 'xls'
      | 'xlsm'
      | 'xlsx'
      | 'zip'
      | 'rar'
    >;
  }

  /**
   * Settings that apply to redirect rules
   */
  export interface Redirect {
    /**
     * URI to which the user will be redirected
     */
    target_uri: string;

    /**
     * If true, context information will be passed as query parameters
     */
    include_context?: boolean;

    /**
     * If true, the path and query parameters from the original request will be
     * appended to target_uri
     */
    preserve_path_and_query?: boolean;
  }

  /**
   * Configure to forward the query to the internal DNS service, passing the
   * specified 'view_id' as input. Cannot be set when 'dns_resolvers' are specified
   * or 'resolve_dns_through_cloudflare' is set. Only valid when a rule's action is
   * set to 'resolve'.
   */
  export interface ResolveDNSInternally {
    /**
     * The fallback behavior to apply when the internal DNS response code is different
     * from 'NOERROR' or when the response data only contains CNAME records for 'A' or
     * 'AAAA' queries.
     */
    fallback?: 'none' | 'public_dns';

    /**
     * The internal DNS view identifier that's passed to the internal DNS service.
     */
    view_id?: string;
  }

  /**
   * Configure behavior when an upstream cert is invalid or an SSL error occurs.
   */
  export interface UntrustedCERT {
    /**
     * The action performed when an untrusted certificate is seen. The default action
     * is an error with HTTP code 526.
     */
    action?: 'pass_through' | 'block' | 'error';
  }
}

/**
 * The schedule for activating DNS policies. This does not apply to HTTP or network
 * policies.
 */
export interface Schedule {
  /**
   * The time intervals when the rule will be active on Fridays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Fridays.
   */
  fri?: string;

  /**
   * The time intervals when the rule will be active on Mondays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Mondays.
   */
  mon?: string;

  /**
   * The time intervals when the rule will be active on Saturdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Saturdays.
   */
  sat?: string;

  /**
   * The time intervals when the rule will be active on Sundays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Sundays.
   */
  sun?: string;

  /**
   * The time intervals when the rule will be active on Thursdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Thursdays.
   */
  thu?: string;

  /**
   * The time zone the rule will be evaluated against. If a
   * [valid time zone city name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)
   * is provided, Gateway will always use the current time at that time zone. If this
   * parameter is omitted, then Gateway will use the time zone inferred from the
   * user's source IP to evaluate the rule. If Gateway cannot determine the time zone
   * from the IP, we will fall back to the time zone of the user's connected data
   * center.
   */
  time_zone?: string;

  /**
   * The time intervals when the rule will be active on Tuesdays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Tuesdays.
   */
  tue?: string;

  /**
   * The time intervals when the rule will be active on Wednesdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Wednesdays.
   */
  wed?: string;
}

/**
 * The schedule for activating DNS policies. This does not apply to HTTP or network
 * policies.
 */
export interface ScheduleParam {
  /**
   * The time intervals when the rule will be active on Fridays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Fridays.
   */
  fri?: string;

  /**
   * The time intervals when the rule will be active on Mondays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Mondays.
   */
  mon?: string;

  /**
   * The time intervals when the rule will be active on Saturdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Saturdays.
   */
  sat?: string;

  /**
   * The time intervals when the rule will be active on Sundays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Sundays.
   */
  sun?: string;

  /**
   * The time intervals when the rule will be active on Thursdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Thursdays.
   */
  thu?: string;

  /**
   * The time zone the rule will be evaluated against. If a
   * [valid time zone city name](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones#List)
   * is provided, Gateway will always use the current time at that time zone. If this
   * parameter is omitted, then Gateway will use the time zone inferred from the
   * user's source IP to evaluate the rule. If Gateway cannot determine the time zone
   * from the IP, we will fall back to the time zone of the user's connected data
   * center.
   */
  time_zone?: string;

  /**
   * The time intervals when the rule will be active on Tuesdays, in increasing order
   * from 00:00-24:00. If this parameter is omitted, the rule will be deactivated on
   * Tuesdays.
   */
  tue?: string;

  /**
   * The time intervals when the rule will be active on Wednesdays, in increasing
   * order from 00:00-24:00. If this parameter is omitted, the rule will be
   * deactivated on Wednesdays.
   */
  wed?: string;
}

export type RuleDeleteResponse = unknown;

export interface RuleCreateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The action to preform when the associated traffic, identity, and
   * device posture expressions are either absent or evaluate to `true`.
   */
  action:
    | 'on'
    | 'off'
    | 'allow'
    | 'block'
    | 'scan'
    | 'noscan'
    | 'safesearch'
    | 'ytrestricted'
    | 'isolate'
    | 'noisolate'
    | 'override'
    | 'l4_override'
    | 'egress'
    | 'resolve'
    | 'quarantine'
    | 'redirect';

  /**
   * Body param: The name of the rule.
   */
  name: string;

  /**
   * Body param: The description of the rule.
   */
  description?: string;

  /**
   * Body param: The wirefilter expression used for device posture check matching.
   */
  device_posture?: string;

  /**
   * Body param: True if the rule is enabled.
   */
  enabled?: boolean;

  /**
   * Body param: The expiration time stamp and default duration of a DNS policy.
   * Takes precedence over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  expiration?: RuleCreateParams.Expiration | null;

  /**
   * Body param: The protocol or layer to evaluate the traffic, identity, and device
   * posture expressions.
   */
  filters?: Array<GatewayFilterParam>;

  /**
   * Body param: The wirefilter expression used for identity matching.
   */
  identity?: string;

  /**
   * Body param: Precedence sets the order of your rules. Lower values indicate
   * higher precedence. At each processing phase, applicable rules are evaluated in
   * ascending order of this value. Refer to
   * [Order of enforcement](http://developers.cloudflare.com/learning-paths/secure-internet-traffic/understand-policies/order-of-enforcement/#manage-precedence-with-terraform)
   * docs on how to manage precedence via Terraform.
   */
  precedence?: number;

  /**
   * Body param: Additional settings that modify the rule's action.
   */
  rule_settings?: RuleSettingParam;

  /**
   * Body param: The schedule for activating DNS policies. This does not apply to
   * HTTP or network policies.
   */
  schedule?: ScheduleParam | null;

  /**
   * Body param: The wirefilter expression used for traffic matching.
   */
  traffic?: string;
}

export namespace RuleCreateParams {
  /**
   * The expiration time stamp and default duration of a DNS policy. Takes precedence
   * over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  export interface Expiration {
    /**
     * The time stamp at which the policy will expire and cease to be applied.
     *
     * Must adhere to RFC 3339 and include a UTC offset. Non-zero offsets are accepted
     * but will be converted to the equivalent value with offset zero (UTC+00:00) and
     * will be returned as time stamps with offset zero denoted by a trailing 'Z'.
     *
     * Policies with an expiration do not consider the timezone of clients they are
     * applied to, and expire "globally" at the point given by their `expires_at`
     * value.
     */
    expires_at: string;

    /**
     * The default duration a policy will be active in minutes. Must be set in order to
     * use the `reset_expiration` endpoint on this rule.
     */
    duration?: number;
  }
}

export interface RuleUpdateParams {
  /**
   * Path param:
   */
  account_id: string;

  /**
   * Body param: The action to preform when the associated traffic, identity, and
   * device posture expressions are either absent or evaluate to `true`.
   */
  action:
    | 'on'
    | 'off'
    | 'allow'
    | 'block'
    | 'scan'
    | 'noscan'
    | 'safesearch'
    | 'ytrestricted'
    | 'isolate'
    | 'noisolate'
    | 'override'
    | 'l4_override'
    | 'egress'
    | 'resolve'
    | 'quarantine'
    | 'redirect';

  /**
   * Body param: The name of the rule.
   */
  name: string;

  /**
   * Body param: The description of the rule.
   */
  description?: string;

  /**
   * Body param: The wirefilter expression used for device posture check matching.
   */
  device_posture?: string;

  /**
   * Body param: True if the rule is enabled.
   */
  enabled?: boolean;

  /**
   * Body param: The expiration time stamp and default duration of a DNS policy.
   * Takes precedence over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  expiration?: RuleUpdateParams.Expiration | null;

  /**
   * Body param: The protocol or layer to evaluate the traffic, identity, and device
   * posture expressions.
   */
  filters?: Array<GatewayFilterParam>;

  /**
   * Body param: The wirefilter expression used for identity matching.
   */
  identity?: string;

  /**
   * Body param: Precedence sets the order of your rules. Lower values indicate
   * higher precedence. At each processing phase, applicable rules are evaluated in
   * ascending order of this value. Refer to
   * [Order of enforcement](http://developers.cloudflare.com/learning-paths/secure-internet-traffic/understand-policies/order-of-enforcement/#manage-precedence-with-terraform)
   * docs on how to manage precedence via Terraform.
   */
  precedence?: number;

  /**
   * Body param: Additional settings that modify the rule's action.
   */
  rule_settings?: RuleSettingParam;

  /**
   * Body param: The schedule for activating DNS policies. This does not apply to
   * HTTP or network policies.
   */
  schedule?: ScheduleParam | null;

  /**
   * Body param: The wirefilter expression used for traffic matching.
   */
  traffic?: string;
}

export namespace RuleUpdateParams {
  /**
   * The expiration time stamp and default duration of a DNS policy. Takes precedence
   * over the policy's `schedule` configuration, if any.
   *
   * This does not apply to HTTP or network policies.
   */
  export interface Expiration {
    /**
     * The time stamp at which the policy will expire and cease to be applied.
     *
     * Must adhere to RFC 3339 and include a UTC offset. Non-zero offsets are accepted
     * but will be converted to the equivalent value with offset zero (UTC+00:00) and
     * will be returned as time stamps with offset zero denoted by a trailing 'Z'.
     *
     * Policies with an expiration do not consider the timezone of clients they are
     * applied to, and expire "globally" at the point given by their `expires_at`
     * value.
     */
    expires_at: string;

    /**
     * The default duration a policy will be active in minutes. Must be set in order to
     * use the `reset_expiration` endpoint on this rule.
     */
    duration?: number;
  }
}

export interface RuleListParams {
  account_id: string;
}

export interface RuleDeleteParams {
  account_id: string;
}

export interface RuleGetParams {
  account_id: string;
}

export interface RuleResetExpirationParams {
  account_id: string;
}

Rules.GatewayRulesSinglePage = GatewayRulesSinglePage;

export declare namespace Rules {
  export {
    type DNSResolverSettingsV4 as DNSResolverSettingsV4,
    type DNSResolverSettingsV6 as DNSResolverSettingsV6,
    type GatewayFilter as GatewayFilter,
    type GatewayRule as GatewayRule,
    type RuleSetting as RuleSetting,
    type Schedule as Schedule,
    type RuleDeleteResponse as RuleDeleteResponse,
    GatewayRulesSinglePage as GatewayRulesSinglePage,
    type RuleCreateParams as RuleCreateParams,
    type RuleUpdateParams as RuleUpdateParams,
    type RuleListParams as RuleListParams,
    type RuleDeleteParams as RuleDeleteParams,
    type RuleGetParams as RuleGetParams,
    type RuleResetExpirationParams as RuleResetExpirationParams,
  };
}
