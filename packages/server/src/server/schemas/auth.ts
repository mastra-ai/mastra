import { z } from 'zod';

// ============================================================================
// Capabilities Response Schemas
// ============================================================================

export const ssoConfigSchema = z.object({
  provider: z.string(),
  text: z.string(),
  icon: z.string().optional(),
  url: z.string(),
});

export const loginConfigSchema = z
  .object({
    type: z.enum(['sso', 'credentials', 'both']),
    sso: ssoConfigSchema.optional(),
  })
  .nullable();

export const publicCapabilitiesSchema = z.object({
  enabled: z.boolean(),
  login: loginConfigSchema,
});

export const authenticatedUserSchema = z.object({
  id: z.string(),
  email: z.string().optional(),
  name: z.string().optional(),
  avatarUrl: z.string().optional(),
});

export const capabilityFlagsSchema = z.object({
  user: z.boolean(),
  session: z.boolean(),
  sso: z.boolean(),
  rbac: z.boolean(),
  acl: z.boolean(),
});

export const userAccessSchema = z
  .object({
    roles: z.array(z.string()),
    permissions: z.array(z.string()),
  })
  .nullable();

export const authenticatedCapabilitiesSchema = publicCapabilitiesSchema.extend({
  user: authenticatedUserSchema,
  capabilities: capabilityFlagsSchema,
  access: userAccessSchema,
});

export const capabilitiesResponseSchema = z.union([publicCapabilitiesSchema, authenticatedCapabilitiesSchema]);

// ============================================================================
// SSO Schemas
// ============================================================================

export const ssoLoginQuerySchema = z.object({
  redirect_uri: z.string().optional(),
});

export const ssoCallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string().optional(),
});

export const ssoLoginResponseSchema = z.object({
  url: z.string(),
});

export const ssoCallbackResponseSchema = z.object({
  success: z.boolean(),
  user: authenticatedUserSchema.optional(),
  redirectTo: z.string().optional(),
});

// ============================================================================
// Logout Schema
// ============================================================================

export const logoutResponseSchema = z.object({
  success: z.boolean(),
  redirectTo: z.string().optional(),
});

// ============================================================================
// Current User Schema
// ============================================================================

export const currentUserResponseSchema = z
  .object({
    id: z.string(),
    email: z.string().optional(),
    name: z.string().optional(),
    avatarUrl: z.string().optional(),
    roles: z.array(z.string()).optional(),
    permissions: z.array(z.string()).optional(),
  })
  .nullable();

// ============================================================================
// Credentials Schemas
// ============================================================================

export const credentialsSignInBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const credentialsSignUpBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  name: z.string().optional(),
});

export const credentialsResponseSchema = z.object({
  user: authenticatedUserSchema,
  token: z.string().optional(),
});
