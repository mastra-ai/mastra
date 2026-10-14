import type { FactoryAuthState } from '../../../services/auth';

export const signedInAccount = {
  authenticated: true,
  user: { userId: 'user-1', email: 'dev@mastra.ai', name: 'Dev' },
  provider: 'workos',
} satisfies Omit<FactoryAuthState, 'authEnabled'>;
