/*
 * Copyright OpenSearch Contributors
 * SPDX-License-Identifier: Apache-2.0
 *
 * The OpenSearch Contributors require contributions made to
 * this file be licensed under the Apache-2.0 license or a
 * compatible open source license.
 *
 */

/*
 * This file was generated from the OpenSearch API Spec. Do NOT edit it
 * manually. If you want to make changes, either update the spec or
 * modify the API generator.
 */


export type AccountDetails = {
  backend_roles?: string[];
  custom_attribute_names?: string[];
  is_hidden?: boolean;
  is_internal_user?: boolean;
  is_reserved?: boolean;
  roles?: string[];
  tenants?: UserTenants;
  user_name?: string;
  user_requested_tenant?: undefined | string;
}

export type ActionGroup = {
  allowed_actions?: string[];
  description?: string;
  hidden?: boolean;
  reserved?: boolean;
  static?: boolean;
  type?: string;
}

export type ActionGroupsMap = Record<string, ActionGroup>

export type AllowListConfig = {
  enabled?: boolean;
  requests?: Record<string, any>;
}

export type AuditConfig = {
  audit?: AuditLogsConfig;
  compliance?: ComplianceConfig;
  enabled?: boolean;
}

export type AuditConfigWithReadOnly = {
  _readonly?: string[];
  config?: AuditConfig;
}

export type AuditLogsConfig = {
  disabled_rest_categories?: string[];
  disabled_transport_categories?: string[];
  enable_rest?: boolean;
  enable_transport?: boolean;
  exclude_sensitive_headers?: boolean;
  ignore_headers?: string[];
  ignore_requests?: string[];
  ignore_url_params?: string[];
  ignore_users?: string[];
  log_request_body?: boolean;
  resolve_bulk_requests?: boolean;
  resolve_indices?: boolean;
}

export type AuthInfo = {
  backend_roles?: string[];
  custom_attribute_names?: string[];
  peer_certificates?: number | string;
  principal?: undefined | string;
  remote_address?: undefined | string;
  roles?: string[];
  size_of_backendroles?: string;
  size_of_custom_attributes?: string;
  size_of_user?: string;
  sso_logout_url?: undefined | string;
  tenants?: Record<string, any>;
  user?: string;
  user_name?: string;
  user_requested_tenant?: undefined | string;
}

export type CertificateCountPerNode = {
  failed?: number;
  successful?: number;
  total?: number;
}

export type CertificatesDetail = {
  issuer_dn?: string;
  not_after?: string;
  not_before?: string;
  san?: string;
  subject_dn?: string;
}

export type CertificatesPerNode = {
  certificates?: Record<string, CertificateTypes>;
  name?: string;
}

export type CertificateTypes = {
  http?: Record<string, CertificatesDetail>[];
  transport?: Record<string, CertificatesDetail>[];
}

export type ChangePasswordRequestContent = {
  current_password: string;
  password: string;
}

export type ClientError = {
  error?: string;
  status?: number;
}

export type ComplianceConfig = {
  enabled?: boolean;
  external_config?: boolean;
  internal_config?: boolean;
  read_ignore_users?: string[];
  read_metadata_only?: boolean;
  read_watched_fields?: any;
  write_ignore_users?: string[];
  write_log_diffs?: boolean;
  write_metadata_only?: boolean;
  write_watched_indices?: string[];
}

export type ConfigUpgradePayload = {
  config?: string[];
}

export type Created = {
  message?: string;
  status?: number | string;
}

export type CreateTenantParams = {
  description?: string;
}

export type DashboardsInfo = {
  default_tenant?: string;
  multitenancy_enabled?: boolean;
  not_fail_on_forbidden_enabled?: boolean;
  opensearch_dashboards_index?: string;
  opensearch_dashboards_mt_enabled?: boolean;
  opensearch_dashboards_server_user?: string;
  password_validation_error_message?: string;
  password_validation_regex?: string;
  private_tenant_enabled?: boolean;
  sign_in_options?: string[];
  user_name?: string;
}

export type DistinguishedNames = {
  nodes_dn?: string[];
}

export type DistinguishedNamesMap = Record<string, DistinguishedNames>

export type DynamicConfig = {
  dynamic?: DynamicOptions;
}

export type DynamicOptions = {
  auth_failure_listeners?: Record<string, any>;
  authc?: Record<string, any>;
  authz?: Record<string, any>;
  disable_intertransport_auth?: boolean;
  disable_rest_auth?: boolean;
  do_not_fail_on_forbidden?: boolean;
  do_not_fail_on_forbidden_empty?: boolean;
  filtered_alias_mode?: string;
  hosts_resolver_mode?: string;
  http?: Record<string, any>;
  kibana?: Record<string, any>;
  multi_rolespan_enabled?: boolean;
  on_behalf_of?: Record<string, any>;
  'opensearch-dashboards'?: Record<string, any>;
  respect_request_indices_options?: boolean;
}

export type Error = {
  message?: string;
  status?: 'BAD_REQUEST' | 'CONFLICT' | 'FORBIDDEN' | 'INTERNAL_SERVER_ERROR' | 'NOT_FOUND' | 'NOT_IMPLEMENTED' | 'UNAUTHORIZED';
}

export type GenerateOBOToken = {
  authenticationToken?: string;
  durationSeconds?: string;
  user?: string;
}

export type GetCertificates = {
  http_certificates_list?: CertificatesDetail[];
  transport_certificates_list?: CertificatesDetail[];
}

export type GetCertificatesNew = {
  _nodes?: Record<string, CertificateCountPerNode>;
  cluster_name?: string;
  nodes?: Record<string, CertificatesPerNode>;
}

export type HealthInfo = {
  message?: undefined | string;
  mode?: string;
  status?: string;
}

export type IndexPermission = {
  allowed_actions?: string[];
  dls?: string;
  fls?: string[];
  index_patterns?: string[];
  masked_fields?: string[];
}

export type InternalServerError = {
  error?: string;
}

export type MultiTenancyConfig = {
  default_tenant?: string;
  multitenancy_enabled?: boolean;
  private_tenant_enabled?: boolean;
  sign_in_options?: string[];
}

export type OBOToken = {
  description: string;
  duration?: string;
  service?: string;
}

export type Ok = {
  message?: string;
  status?: number | string;
}

export type PatchOperation = {
  op: string;
  path: string;
  value?: Record<string, any>;
}

export type PatchOperations = PatchOperation[]

export type PermissionsInfo = {
  disabled_endpoints?: Record<string, any>;
  has_api_access?: boolean;
  user?: string;
  user_name?: string;
}

export type Role = {
  cluster_permissions?: string[];
  description?: string;
  hidden?: boolean;
  index_permissions?: IndexPermission[];
  reserved?: boolean;
  static?: boolean;
  tenant_permissions?: TenantPermission[];
}

export type RoleMapping = {
  and_backend_roles?: string[];
  backend_roles?: string[];
  description?: string;
  hidden?: boolean;
  hosts?: string[];
  reserved?: boolean;
  users?: string[];
}

export type RoleMappings = Record<string, RoleMapping>

export type RolesMap = Record<string, Role>

export type SecurityConfig = {
  config?: DynamicConfig;
}

export type SSLInfo = {
  local_certificates_list?: string[];
  peer_certificates: number | string;
  peer_certificates_list?: string[];
  principal: undefined | string;
  ssl_cipher: undefined | string;
  ssl_openssl_available: boolean;
  ssl_openssl_non_available_cause: undefined | string;
  ssl_openssl_supports_hostname_validation: boolean;
  ssl_openssl_supports_key_manager_factory: boolean;
  ssl_openssl_version: number | string;
  ssl_openssl_version_string: undefined | string;
  ssl_protocol: undefined | string;
  ssl_provider_http: undefined | string;
  ssl_provider_transport_client: string;
  ssl_provider_transport_server: string;
}

export type Tenant = {
  description?: string;
  hidden?: boolean;
  reserved?: boolean;
  static?: boolean;
}

export type TenantInfo = Record<string, string>

export type TenantPermission = {
  allowed_actions?: string[];
  tenant_patterns?: string[];
}

export type TenantsMap = Record<string, Tenant>

export type UpgradeCheck = {
  status?: string;
  upgradeActions?: Record<string, any>;
  upgradeAvailable?: boolean;
}

export type UpgradePerform = {
  status?: string;
  upgrades?: Record<string, any>;
}

export type User = {
  attributes?: UserAttributes;
  backend_roles?: string[];
  description?: string;
  hash?: string;
  hidden?: boolean;
  opendistro_security_roles?: string[];
  password?: string;
  reserved?: boolean;
  static?: boolean;
}

export type UserAttributes = Record<string, string>

export type UsersMap = Record<string, User>

export type UserTenants = {
  admin?: boolean;
  admin_tenant?: boolean;
  global_tenant?: boolean;
}

export type WhoAmI = {
  dn?: undefined | string;
  is_admin?: boolean;
  is_node_certificate_request?: boolean;
}

