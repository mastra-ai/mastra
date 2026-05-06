import type { MastraClient } from '@mastra/client-js';
import { coreFeatures } from '@mastra/core/features';

/**
 * Checks if a method exists on an object and is callable.
 */
function hasMethod<T>(obj: T, method: string): boolean {
  return method in (obj as object) && typeof (obj as Record<string, unknown>)[method] === 'function';
}

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
