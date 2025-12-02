"use strict";
import { z } from "zod";
export const reference = z.string();
const Oidc = z.object({
  applicationID: z.string(),
  domain: z.string()
}).passthrough();
const CustomJwt = z.object({
  type: z.literal("customJwt"),
  applicationID: z.string().nullable(),
  issuer: z.string(),
  jwks: z.string(),
  algorithm: z.string()
}).passthrough();
export const authInfo = z.union([CustomJwt, Oidc]);
export const identifier = z.string();
//# sourceMappingURL=types.js.map
