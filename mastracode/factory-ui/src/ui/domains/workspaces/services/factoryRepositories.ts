import type { FactoryProject } from './github';

/** Boards show a Factory's intake, and its session runs are tracked, once it has a linked repository. */
export function hasLinkedRepository(factory: FactoryProject): boolean {
  return factory.repositories.length > 0;
}
