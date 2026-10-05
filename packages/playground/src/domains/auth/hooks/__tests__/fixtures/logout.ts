import type { makeLogoutRequest } from '@mastra/react/hooks';

export const logoutResponse: Awaited<ReturnType<typeof makeLogoutRequest>> = {
  success: true,
  redirectTo: 'https://identity.example.com/logout',
};
