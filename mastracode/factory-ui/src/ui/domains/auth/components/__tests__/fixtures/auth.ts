import type { FactoryAuthState } from '../../../services/auth';
import type { FactoryProjectPayload } from '../../../../workspaces/services/github';

export const signedIn: FactoryAuthState = {
  authEnabled: true,
  authenticated: true,
  provider: 'workos',
  user: { userId: 'user-1', email: 'dev@mastra.ai', name: 'Dev' },
};

export const signedOut: FactoryAuthState = {
  authEnabled: true,
  authenticated: false,
  provider: 'workos',
};

export const factory: FactoryProjectPayload = { id: 'factory-1', name: 'Factory' };
