import type { AdminServerContext, AdminServerRoute } from '../types';
import {
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  getMeResponseSchema,
  refreshTokenBodySchema,
  refreshTokenResponseSchema,
} from '../schemas/auth';

/**
 * POST /auth/login - Login via auth provider.
 */
export const LOGIN_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/auth/login',
  responseType: 'json',
  bodySchema: loginBodySchema,
  responseSchema: loginResponseSchema,
  requiresAuth: false,
  summary: 'Login',
  description: 'Authenticate with the configured auth provider',
  tags: ['Auth'],
  handler: async params => {
    const { admin } = params;
    const auth = admin.getAuth();
    if (!auth) {
      throw new Error('Auth provider not configured');
    }

    // Auth is handled by the auth provider configured in MastraAdmin
    // This endpoint delegates to the auth provider's login method
    // The actual implementation depends on the auth provider (e.g., Supabase, Auth0)
    throw new Error('Login must be implemented by the auth provider');
  },
};

/**
 * POST /auth/logout - Logout current session.
 */
export const LOGOUT_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/auth/logout',
  responseType: 'json',
  responseSchema: logoutResponseSchema,
  summary: 'Logout',
  description: 'End the current session',
  tags: ['Auth'],
  handler: async params => {
    // Session invalidation is typically handled by the auth provider
    // For token-based auth, the client should discard the token
    return { success: true };
  },
};

/**
 * GET /auth/me - Get current user info.
 */
export const GET_ME_ROUTE: AdminServerRoute = {
  method: 'GET',
  path: '/auth/me',
  responseType: 'json',
  responseSchema: getMeResponseSchema,
  summary: 'Get current user',
  description: 'Get information about the authenticated user',
  tags: ['Auth'],
  handler: async params => {
    const { admin, userId } = params;
    const user = await admin.getUser(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  },
};

/**
 * POST /auth/refresh - Refresh access token.
 */
export const REFRESH_TOKEN_ROUTE: AdminServerRoute = {
  method: 'POST',
  path: '/auth/refresh',
  responseType: 'json',
  bodySchema: refreshTokenBodySchema,
  responseSchema: refreshTokenResponseSchema,
  requiresAuth: false,
  summary: 'Refresh token',
  description: 'Get a new access token using a refresh token',
  tags: ['Auth'],
  handler: async params => {
    const { admin } = params;
    const { refreshToken } = params as AdminServerContext & { refreshToken: string };
    const auth = admin.getAuth();
    if (!auth) {
      throw new Error('Auth provider not configured');
    }

    // Token refresh is handled by the auth provider
    throw new Error('Token refresh must be implemented by the auth provider');
  },
};

/**
 * All auth routes.
 */
export const AUTH_ROUTES: AdminServerRoute[] = [
  LOGIN_ROUTE,
  LOGOUT_ROUTE,
  GET_ME_ROUTE,
  REFRESH_TOKEN_ROUTE,
];
