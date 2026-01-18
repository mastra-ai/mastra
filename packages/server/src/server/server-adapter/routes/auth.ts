import {
  GET_AUTH_CAPABILITIES_ROUTE,
  GET_CURRENT_USER_ROUTE,
  GET_SSO_LOGIN_ROUTE,
  GET_SSO_CALLBACK_ROUTE,
  POST_LOGOUT_ROUTE,
  POST_CREDENTIALS_SIGN_IN_ROUTE,
  POST_CREDENTIALS_SIGN_UP_ROUTE,
} from '../../handlers/auth';

/**
 * Auth Routes
 *
 * Routes for authentication and authorization.
 * Includes SSO, credentials login/signup, session management, and capabilities detection.
 */
export const AUTH_ROUTES = [
  GET_AUTH_CAPABILITIES_ROUTE,
  GET_CURRENT_USER_ROUTE,
  GET_SSO_LOGIN_ROUTE,
  GET_SSO_CALLBACK_ROUTE,
  POST_LOGOUT_ROUTE,
  POST_CREDENTIALS_SIGN_IN_ROUTE,
  POST_CREDENTIALS_SIGN_UP_ROUTE,
] as const;
