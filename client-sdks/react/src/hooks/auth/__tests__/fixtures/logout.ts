import type { makeLogoutRequest } from '../../use-auth-actions';

export const logoutResponse: Awaited<ReturnType<typeof makeLogoutRequest>> = {
  success: true,
  redirectTo: 'https://identity.example.com/logout',
};
