import type { InMemoryPushNotificationStore } from './push-notification-store';
import type { A2AEncodeOptions, A2AOperation, A2AProtocolVersion } from './wire-protocol';
import { getA2AServerCodec } from './wire-protocol';

/**
 * Encode options derived from already-decoded (version-blind) operation params.
 */
export function encodeOptionsForOperation(
  operation: A2AOperation,
  params: Record<string, any> | undefined,
): A2AEncodeOptions | undefined {
  if (operation === 'tasks/get') {
    return { historyLength: params?.historyLength };
  }
  if (operation === 'tasks/list') {
    return {
      historyLength: params?.historyLength,
      includeArtifacts: params?.includeArtifacts ?? false,
    };
  }
  return undefined;
}

/**
 * Bind a push-notification store to the request wire version so executors
 * never take a protocolVersion argument for registration.
 */
export function bindPushNotificationStoreVersion(
  store: InMemoryPushNotificationStore,
  protocolVersion: A2AProtocolVersion,
): InMemoryPushNotificationStore {
  return {
    set: args => store.set({ ...args, protocolVersion: args.protocolVersion ?? protocolVersion }),
    get: args => store.get(args),
    list: args => store.list(args),
    listWithProtocolVersion: args => store.listWithProtocolVersion(args),
    delete: args => store.delete(args),
  } as InMemoryPushNotificationStore;
}

export function createA2AJsonResponseHeaders(protocolVersion: A2AProtocolVersion): Record<string, string> {
  return {
    'Content-Type': getA2AServerCodec(protocolVersion).responseContentType,
  };
}
