import { z } from "zod";

export const reference = z.string();
export type Reference = z.infer<typeof reference>;

// These validators parse the response from the backend so although
// they roughly correspond with convex/auth.config.ts providers they
// have been processed.

// Passthrough so old CLIs can operate on new backend formats.
const Oidc = z
  .object({
    applicationID: z.string(),
    domain: z.string(),
  })
  .passthrough();
const CustomJwt = z
  .object({
    type: z.literal("customJwt"),
    applicationID: z.string().nullable(),
    issuer: z.string(),
    jwks: z.string(),
    algorithm: z.string(),
  })
  .passthrough();

export const authInfo = z.union([CustomJwt, Oidc]);

export type AuthInfo = z.infer<typeof authInfo>;

export const identifier = z.string();
export type Identifier = z.infer<typeof identifier>;
