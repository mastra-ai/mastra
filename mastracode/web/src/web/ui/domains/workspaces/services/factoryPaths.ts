import type { Factory } from './factories';
import { isServerFactory } from './factories';

export function sourceFactoryPath(state: unknown): string | undefined {
  if (!state || typeof state !== 'object' || !('from' in state)) return;
  return typeof state.from === 'string' ? state.from : undefined;
}

/**
 * Landing path for a factory. Server factories land on the work board,
 * local factories land on the new-thread composer.
 */
export function factoryHomePath(factory: Factory): string {
  return isServerFactory(factory) ? `/factories/${factory.id}/work` : `/factories/${factory.id}/new`;
}
