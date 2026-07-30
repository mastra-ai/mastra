import type { FactoryProject } from './github';

/** Landing path for a server-backed factory project. */
export function factoryHomePath(factory: FactoryProject): string {
  return `/factories/${factory.id}`;
}
