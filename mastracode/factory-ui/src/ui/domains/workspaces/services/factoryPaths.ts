import { rememberedBoardPath } from '../../factory/services/boardViews';
import type { FactoryProject } from './github';

const PRESERVED_FACTORY_ROUTE =
  /^(?:\/(?:work|review|overview|attention|activity|rules|audit|new)|\/settings(?:\/[^/]+){0,2})\/?$/;
const BUILT_IN_BOARD_ROUTE = /^\/(work|review)\/?$/;

/** Landing path for a server-backed factory project. */
export function factoryHomePath(factory: Pick<FactoryProject, 'id'>): string {
  return `/factories/${factory.id}`;
}

/** Inline create-Factory wizard, kept inside the app shell of the factory in view. */
export function createFactoryPath(factoryId: string): string {
  return `/factories/${factoryId}/new-factory`;
}

export function factorySwitchPath(factory: FactoryProject, location: { pathname: string; hash: string }): string {
  const homePath = factoryHomePath(factory);
  const factoryRouteSuffix = /^\/factories\/[^/]+(\/.*)?$/.exec(location.pathname)?.[1] ?? '';

  if (factoryRouteSuffix && !PRESERVED_FACTORY_ROUTE.test(factoryRouteSuffix)) return `${homePath}/overview`;

  const boardId = BUILT_IN_BOARD_ROUTE.exec(factoryRouteSuffix)?.[1];
  if (boardId) return `${rememberedBoardPath(factory.id, boardId)}${location.hash}`;

  return `${homePath}${factoryRouteSuffix}${location.hash}`;
}
