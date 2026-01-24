import { z } from 'zod';
import { dateSchema } from './common';

/**
 * Login request body schema.
 */
export const loginBodySchema = z.object({
  provider: z.enum(['email', 'github', 'google']).optional().default('email'),
  email: z.string().email().optional(),
  password: z.string().min(1).optional(),
  token: z.string().optional(),
  redirectUrl: z.string().url().optional(),
});

export type LoginBody = z.infer<typeof loginBodySchema>;

/**
 * Login response schema.
 */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: dateSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    name: z.string().nullable(),
    avatarUrl: z.string().url().nullable(),
  }),
});

export type LoginResponse = z.infer<typeof loginResponseSchema>;

/**
 * Logout response schema.
 */
export const logoutResponseSchema = z.object({
  success: z.boolean(),
});

export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

/**
 * Get current user (me) response schema.
 */
export const getMeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  avatarUrl: z.string().url().nullable(),
  createdAt: dateSchema,
  updatedAt: dateSchema,
});

export type GetMeResponse = z.infer<typeof getMeResponseSchema>;

/**
 * Refresh token request body schema.
 */
export const refreshTokenBodySchema = z.object({
  refreshToken: z.string(),
});

export type RefreshTokenBody = z.infer<typeof refreshTokenBodySchema>;

/**
 * Refresh token response schema.
 */
export const refreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  expiresAt: dateSchema,
});

export type RefreshTokenResponse = z.infer<typeof refreshTokenResponseSchema>;
