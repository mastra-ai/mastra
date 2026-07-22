import type { Factory } from './factories';
import { isServerFactory } from './factories';

/**
 * Landing path for a factory. Server factories land on the work board,
 * local factories land on the new-thread composer.
 */
export function factoryHomePath(factory: Factory): string {
  return isServerFactory(factory) ? `/factories/${factory.id}/work` : `/factories/${factory.id}/new`;
}
