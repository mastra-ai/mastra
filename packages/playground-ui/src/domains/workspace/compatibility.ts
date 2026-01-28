import { coreFeatures } from '@mastra/core/features';
import { MastraClient } from '@mastra/client-js';
import { hasMethod } from './client-utils';

/**
 * Checks if workspace v1 features are supported by both core and client.
 * This guards against version mismatches between playground-ui, core, and client-js.
 */
export const isWorkspaceV1Supported = (client: MastraClient) => {
  const workspaceClientMethods = ['listWorkspaces', 'getWorkspace'];

  const coreSupported = coreFeatures.has('workspaces-v1');
  const clientSupported = workspaceClientMethods.every(method => hasMethod(client, method));

  return coreSupported && clientSupported;
};
