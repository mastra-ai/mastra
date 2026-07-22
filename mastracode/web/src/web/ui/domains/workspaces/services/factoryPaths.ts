import type { FactoryProject } from './github';

export function sourceFactoryPath(state: unknown): string | undefined {
  if (!state || typeof state !== 'object' || !('from' in state)) return;
  return typeof state.from === 'string' ? state.from : undefined;
}

/** Landing path for a server-backed factory project. */
export function factoryHomePath(factory: FactoryProject): string {
  return `/factories/${factory.id}`;
}
