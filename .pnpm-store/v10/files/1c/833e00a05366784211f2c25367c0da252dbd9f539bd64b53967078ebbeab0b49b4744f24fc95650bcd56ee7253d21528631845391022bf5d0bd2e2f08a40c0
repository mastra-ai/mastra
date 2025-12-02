import { z } from 'zod';
/**
 * Reusable URL validation that disallows javascript: scheme
 */
export declare const SafeUrlSchema: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
/**
 * RFC 9728 OAuth Protected Resource Metadata
 */
export declare const OAuthProtectedResourceMetadataSchema: z.ZodObject<{
    resource: z.ZodString;
    authorization_servers: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, "many">>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bearer_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_name: z.ZodOptional<z.ZodString>;
    resource_documentation: z.ZodOptional<z.ZodString>;
    resource_policy_uri: z.ZodOptional<z.ZodString>;
    resource_tos_uri: z.ZodOptional<z.ZodString>;
    tls_client_certificate_bound_access_tokens: z.ZodOptional<z.ZodBoolean>;
    authorization_details_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_bound_access_tokens_required: z.ZodOptional<z.ZodBoolean>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    resource: z.ZodString;
    authorization_servers: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, "many">>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bearer_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_name: z.ZodOptional<z.ZodString>;
    resource_documentation: z.ZodOptional<z.ZodString>;
    resource_policy_uri: z.ZodOptional<z.ZodString>;
    resource_tos_uri: z.ZodOptional<z.ZodString>;
    tls_client_certificate_bound_access_tokens: z.ZodOptional<z.ZodBoolean>;
    authorization_details_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_bound_access_tokens_required: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    resource: z.ZodString;
    authorization_servers: z.ZodOptional<z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, "many">>;
    jwks_uri: z.ZodOptional<z.ZodString>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    bearer_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    resource_name: z.ZodOptional<z.ZodString>;
    resource_documentation: z.ZodOptional<z.ZodString>;
    resource_policy_uri: z.ZodOptional<z.ZodString>;
    resource_tos_uri: z.ZodOptional<z.ZodString>;
    tls_client_certificate_bound_access_tokens: z.ZodOptional<z.ZodBoolean>;
    authorization_details_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    dpop_bound_access_tokens_required: z.ZodOptional<z.ZodBoolean>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata
 */
export declare const OAuthMetadataSchema: z.ZodObject<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * OpenID Connect Discovery 1.0 Provider Metadata
 * see: https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
export declare const OpenIdProviderMetadataSchema: z.ZodObject<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, z.ZodTypeAny, "passthrough">>;
/**
 * OpenID Connect Discovery metadata that may include OAuth 2.0 fields
 * This schema represents the real-world scenario where OIDC providers
 * return a mix of OpenID Connect and OAuth 2.0 metadata fields
 */
export declare const OpenIdProviderDiscoveryMetadataSchema: z.ZodObject<z.objectUtil.extendShape<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, Pick<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "code_challenge_methods_supported">>, "passthrough", z.ZodTypeAny, z.objectOutputType<z.objectUtil.extendShape<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, Pick<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "code_challenge_methods_supported">>, z.ZodTypeAny, "passthrough">, z.objectInputType<z.objectUtil.extendShape<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    userinfo_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks_uri: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    acr_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    subject_types_supported: z.ZodArray<z.ZodString, "many">;
    id_token_signing_alg_values_supported: z.ZodArray<z.ZodString, "many">;
    id_token_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    id_token_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    userinfo_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    request_object_encryption_enc_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    display_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claim_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodString>;
    claims_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    ui_locales_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    claims_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    request_uri_parameter_supported: z.ZodOptional<z.ZodBoolean>;
    require_request_uri_registration: z.ZodOptional<z.ZodBoolean>;
    op_policy_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    op_tos_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
}, Pick<{
    issuer: z.ZodString;
    authorization_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    token_endpoint: z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>;
    registration_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    scopes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types_supported: z.ZodArray<z.ZodString, "many">;
    response_modes_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    grant_types_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    token_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    service_documentation: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    revocation_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    revocation_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint: z.ZodOptional<z.ZodString>;
    introspection_endpoint_auth_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    introspection_endpoint_auth_signing_alg_values_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    code_challenge_methods_supported: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "code_challenge_methods_supported">>, z.ZodTypeAny, "passthrough">>;
/**
 * OAuth 2.1 token response
 */
export declare const OAuthTokensSchema: z.ZodObject<{
    access_token: z.ZodString;
    id_token: z.ZodOptional<z.ZodString>;
    token_type: z.ZodString;
    expires_in: z.ZodOptional<z.ZodNumber>;
    scope: z.ZodOptional<z.ZodString>;
    refresh_token: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    access_token: string;
    token_type: string;
    id_token?: string | undefined;
    expires_in?: number | undefined;
    scope?: string | undefined;
    refresh_token?: string | undefined;
}, {
    access_token: string;
    token_type: string;
    id_token?: string | undefined;
    expires_in?: number | undefined;
    scope?: string | undefined;
    refresh_token?: string | undefined;
}>;
/**
 * OAuth 2.1 error response
 */
export declare const OAuthErrorResponseSchema: z.ZodObject<{
    error: z.ZodString;
    error_description: z.ZodOptional<z.ZodString>;
    error_uri: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error: string;
    error_description?: string | undefined;
    error_uri?: string | undefined;
}, {
    error: string;
    error_description?: string | undefined;
    error_uri?: string | undefined;
}>;
/**
 * Optional version of SafeUrlSchema that allows empty string for retrocompatibility on tos_uri and logo_uri
 */
export declare const OptionalSafeUrlSchema: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration metadata
 */
export declare const OAuthClientMetadataSchema: z.ZodObject<{
    redirect_uris: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, "many">;
    token_endpoint_auth_method: z.ZodOptional<z.ZodString>;
    grant_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    client_name: z.ZodOptional<z.ZodString>;
    client_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    logo_uri: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
    scope: z.ZodOptional<z.ZodString>;
    contacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tos_uri: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
    policy_uri: z.ZodOptional<z.ZodString>;
    jwks_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks: z.ZodOptional<z.ZodAny>;
    software_id: z.ZodOptional<z.ZodString>;
    software_version: z.ZodOptional<z.ZodString>;
    software_statement: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    redirect_uris: string[];
    jwks_uri?: string | undefined;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    software_statement?: string | undefined;
}, {
    redirect_uris: string[];
    jwks_uri?: string | undefined;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    software_statement?: string | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration client information
 */
export declare const OAuthClientInformationSchema: z.ZodObject<{
    client_id: z.ZodString;
    client_secret: z.ZodOptional<z.ZodString>;
    client_id_issued_at: z.ZodOptional<z.ZodNumber>;
    client_secret_expires_at: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    client_id: string;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}, {
    client_id: string;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus metadata)
 */
export declare const OAuthClientInformationFullSchema: z.ZodObject<z.objectUtil.extendShape<{
    redirect_uris: z.ZodArray<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>, "many">;
    token_endpoint_auth_method: z.ZodOptional<z.ZodString>;
    grant_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    response_types: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    client_name: z.ZodOptional<z.ZodString>;
    client_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    logo_uri: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
    scope: z.ZodOptional<z.ZodString>;
    contacts: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    tos_uri: z.ZodUnion<[z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>, z.ZodEffects<z.ZodLiteral<"">, undefined, "">]>;
    policy_uri: z.ZodOptional<z.ZodString>;
    jwks_uri: z.ZodOptional<z.ZodEffects<z.ZodEffects<z.ZodString, string, string>, string, string>>;
    jwks: z.ZodOptional<z.ZodAny>;
    software_id: z.ZodOptional<z.ZodString>;
    software_version: z.ZodOptional<z.ZodString>;
    software_statement: z.ZodOptional<z.ZodString>;
}, {
    client_id: z.ZodString;
    client_secret: z.ZodOptional<z.ZodString>;
    client_id_issued_at: z.ZodOptional<z.ZodNumber>;
    client_secret_expires_at: z.ZodOptional<z.ZodNumber>;
}>, "strip", z.ZodTypeAny, {
    redirect_uris: string[];
    client_id: string;
    jwks_uri?: string | undefined;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    software_statement?: string | undefined;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}, {
    redirect_uris: string[];
    client_id: string;
    jwks_uri?: string | undefined;
    scope?: string | undefined;
    token_endpoint_auth_method?: string | undefined;
    grant_types?: string[] | undefined;
    response_types?: string[] | undefined;
    client_name?: string | undefined;
    client_uri?: string | undefined;
    logo_uri?: string | undefined;
    contacts?: string[] | undefined;
    tos_uri?: string | undefined;
    policy_uri?: string | undefined;
    jwks?: any;
    software_id?: string | undefined;
    software_version?: string | undefined;
    software_statement?: string | undefined;
    client_secret?: string | undefined;
    client_id_issued_at?: number | undefined;
    client_secret_expires_at?: number | undefined;
}>;
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration error response
 */
export declare const OAuthClientRegistrationErrorSchema: z.ZodObject<{
    error: z.ZodString;
    error_description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    error: string;
    error_description?: string | undefined;
}, {
    error: string;
    error_description?: string | undefined;
}>;
/**
 * RFC 7009 OAuth 2.0 Token Revocation request
 */
export declare const OAuthTokenRevocationRequestSchema: z.ZodObject<{
    token: z.ZodString;
    token_type_hint: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    token: string;
    token_type_hint?: string | undefined;
}, {
    token: string;
    token_type_hint?: string | undefined;
}>;
export type OAuthMetadata = z.infer<typeof OAuthMetadataSchema>;
export type OpenIdProviderMetadata = z.infer<typeof OpenIdProviderMetadataSchema>;
export type OpenIdProviderDiscoveryMetadata = z.infer<typeof OpenIdProviderDiscoveryMetadataSchema>;
export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;
export type OAuthErrorResponse = z.infer<typeof OAuthErrorResponseSchema>;
export type OAuthClientMetadata = z.infer<typeof OAuthClientMetadataSchema>;
export type OAuthClientInformation = z.infer<typeof OAuthClientInformationSchema>;
export type OAuthClientInformationFull = z.infer<typeof OAuthClientInformationFullSchema>;
export type OAuthClientRegistrationError = z.infer<typeof OAuthClientRegistrationErrorSchema>;
export type OAuthTokenRevocationRequest = z.infer<typeof OAuthTokenRevocationRequestSchema>;
export type OAuthProtectedResourceMetadata = z.infer<typeof OAuthProtectedResourceMetadataSchema>;
export type AuthorizationServerMetadata = OAuthMetadata | OpenIdProviderDiscoveryMetadata;
//# sourceMappingURL=auth.d.ts.map