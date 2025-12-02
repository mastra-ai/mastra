"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuthTokenRevocationRequestSchema = exports.OAuthClientRegistrationErrorSchema = exports.OAuthClientInformationFullSchema = exports.OAuthClientInformationSchema = exports.OAuthClientMetadataSchema = exports.OptionalSafeUrlSchema = exports.OAuthErrorResponseSchema = exports.OAuthTokensSchema = exports.OpenIdProviderDiscoveryMetadataSchema = exports.OpenIdProviderMetadataSchema = exports.OAuthMetadataSchema = exports.OAuthProtectedResourceMetadataSchema = exports.SafeUrlSchema = void 0;
const zod_1 = require("zod");
/**
 * Reusable URL validation that disallows javascript: scheme
 */
exports.SafeUrlSchema = zod_1.z
    .string()
    .url()
    .superRefine((val, ctx) => {
    if (!URL.canParse(val)) {
        ctx.addIssue({
            code: zod_1.z.ZodIssueCode.custom,
            message: 'URL must be parseable',
            fatal: true
        });
        return zod_1.z.NEVER;
    }
})
    .refine(url => {
    const u = new URL(url);
    return u.protocol !== 'javascript:' && u.protocol !== 'data:' && u.protocol !== 'vbscript:';
}, { message: 'URL cannot use javascript:, data:, or vbscript: scheme' });
/**
 * RFC 9728 OAuth Protected Resource Metadata
 */
exports.OAuthProtectedResourceMetadataSchema = zod_1.z
    .object({
    resource: zod_1.z.string().url(),
    authorization_servers: zod_1.z.array(exports.SafeUrlSchema).optional(),
    jwks_uri: zod_1.z.string().url().optional(),
    scopes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    bearer_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    resource_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    resource_name: zod_1.z.string().optional(),
    resource_documentation: zod_1.z.string().optional(),
    resource_policy_uri: zod_1.z.string().url().optional(),
    resource_tos_uri: zod_1.z.string().url().optional(),
    tls_client_certificate_bound_access_tokens: zod_1.z.boolean().optional(),
    authorization_details_types_supported: zod_1.z.array(zod_1.z.string()).optional(),
    dpop_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    dpop_bound_access_tokens_required: zod_1.z.boolean().optional()
})
    .passthrough();
/**
 * RFC 8414 OAuth 2.0 Authorization Server Metadata
 */
exports.OAuthMetadataSchema = zod_1.z
    .object({
    issuer: zod_1.z.string(),
    authorization_endpoint: exports.SafeUrlSchema,
    token_endpoint: exports.SafeUrlSchema,
    registration_endpoint: exports.SafeUrlSchema.optional(),
    scopes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    response_types_supported: zod_1.z.array(zod_1.z.string()),
    response_modes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    grant_types_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    service_documentation: exports.SafeUrlSchema.optional(),
    revocation_endpoint: exports.SafeUrlSchema.optional(),
    revocation_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    revocation_endpoint_auth_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    introspection_endpoint: zod_1.z.string().optional(),
    introspection_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    introspection_endpoint_auth_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    code_challenge_methods_supported: zod_1.z.array(zod_1.z.string()).optional()
})
    .passthrough();
/**
 * OpenID Connect Discovery 1.0 Provider Metadata
 * see: https://openid.net/specs/openid-connect-discovery-1_0.html#ProviderMetadata
 */
exports.OpenIdProviderMetadataSchema = zod_1.z
    .object({
    issuer: zod_1.z.string(),
    authorization_endpoint: exports.SafeUrlSchema,
    token_endpoint: exports.SafeUrlSchema,
    userinfo_endpoint: exports.SafeUrlSchema.optional(),
    jwks_uri: exports.SafeUrlSchema,
    registration_endpoint: exports.SafeUrlSchema.optional(),
    scopes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    response_types_supported: zod_1.z.array(zod_1.z.string()),
    response_modes_supported: zod_1.z.array(zod_1.z.string()).optional(),
    grant_types_supported: zod_1.z.array(zod_1.z.string()).optional(),
    acr_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    subject_types_supported: zod_1.z.array(zod_1.z.string()),
    id_token_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()),
    id_token_encryption_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    id_token_encryption_enc_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    userinfo_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    userinfo_encryption_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    userinfo_encryption_enc_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    request_object_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    request_object_encryption_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    request_object_encryption_enc_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_methods_supported: zod_1.z.array(zod_1.z.string()).optional(),
    token_endpoint_auth_signing_alg_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    display_values_supported: zod_1.z.array(zod_1.z.string()).optional(),
    claim_types_supported: zod_1.z.array(zod_1.z.string()).optional(),
    claims_supported: zod_1.z.array(zod_1.z.string()).optional(),
    service_documentation: zod_1.z.string().optional(),
    claims_locales_supported: zod_1.z.array(zod_1.z.string()).optional(),
    ui_locales_supported: zod_1.z.array(zod_1.z.string()).optional(),
    claims_parameter_supported: zod_1.z.boolean().optional(),
    request_parameter_supported: zod_1.z.boolean().optional(),
    request_uri_parameter_supported: zod_1.z.boolean().optional(),
    require_request_uri_registration: zod_1.z.boolean().optional(),
    op_policy_uri: exports.SafeUrlSchema.optional(),
    op_tos_uri: exports.SafeUrlSchema.optional()
})
    .passthrough();
/**
 * OpenID Connect Discovery metadata that may include OAuth 2.0 fields
 * This schema represents the real-world scenario where OIDC providers
 * return a mix of OpenID Connect and OAuth 2.0 metadata fields
 */
exports.OpenIdProviderDiscoveryMetadataSchema = exports.OpenIdProviderMetadataSchema.merge(exports.OAuthMetadataSchema.pick({
    code_challenge_methods_supported: true
}));
/**
 * OAuth 2.1 token response
 */
exports.OAuthTokensSchema = zod_1.z
    .object({
    access_token: zod_1.z.string(),
    id_token: zod_1.z.string().optional(), // Optional for OAuth 2.1, but necessary in OpenID Connect
    token_type: zod_1.z.string(),
    expires_in: zod_1.z.number().optional(),
    scope: zod_1.z.string().optional(),
    refresh_token: zod_1.z.string().optional()
})
    .strip();
/**
 * OAuth 2.1 error response
 */
exports.OAuthErrorResponseSchema = zod_1.z.object({
    error: zod_1.z.string(),
    error_description: zod_1.z.string().optional(),
    error_uri: zod_1.z.string().optional()
});
/**
 * Optional version of SafeUrlSchema that allows empty string for retrocompatibility on tos_uri and logo_uri
 */
exports.OptionalSafeUrlSchema = exports.SafeUrlSchema.optional().or(zod_1.z.literal('').transform(() => undefined));
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration metadata
 */
exports.OAuthClientMetadataSchema = zod_1.z
    .object({
    redirect_uris: zod_1.z.array(exports.SafeUrlSchema),
    token_endpoint_auth_method: zod_1.z.string().optional(),
    grant_types: zod_1.z.array(zod_1.z.string()).optional(),
    response_types: zod_1.z.array(zod_1.z.string()).optional(),
    client_name: zod_1.z.string().optional(),
    client_uri: exports.SafeUrlSchema.optional(),
    logo_uri: exports.OptionalSafeUrlSchema,
    scope: zod_1.z.string().optional(),
    contacts: zod_1.z.array(zod_1.z.string()).optional(),
    tos_uri: exports.OptionalSafeUrlSchema,
    policy_uri: zod_1.z.string().optional(),
    jwks_uri: exports.SafeUrlSchema.optional(),
    jwks: zod_1.z.any().optional(),
    software_id: zod_1.z.string().optional(),
    software_version: zod_1.z.string().optional(),
    software_statement: zod_1.z.string().optional()
})
    .strip();
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration client information
 */
exports.OAuthClientInformationSchema = zod_1.z
    .object({
    client_id: zod_1.z.string(),
    client_secret: zod_1.z.string().optional(),
    client_id_issued_at: zod_1.z.number().optional(),
    client_secret_expires_at: zod_1.z.number().optional()
})
    .strip();
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus metadata)
 */
exports.OAuthClientInformationFullSchema = exports.OAuthClientMetadataSchema.merge(exports.OAuthClientInformationSchema);
/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration error response
 */
exports.OAuthClientRegistrationErrorSchema = zod_1.z
    .object({
    error: zod_1.z.string(),
    error_description: zod_1.z.string().optional()
})
    .strip();
/**
 * RFC 7009 OAuth 2.0 Token Revocation request
 */
exports.OAuthTokenRevocationRequestSchema = zod_1.z
    .object({
    token: zod_1.z.string(),
    token_type_hint: zod_1.z.string().optional()
})
    .strip();
//# sourceMappingURL=auth.js.map