import type { FactoryProject } from './github';

const PRESERVED_FACTORY_ROUTE =
  /^(?:\/(?:work|review|overview|metrics|rules|audit|new)|\/settings(?:\/[^/]+){0,2})\/?$/;

/** Landing path for a server-backed factory project. */
export function factoryHomePath(factory: FactoryProject): string {
  return `/factories/${factory.id}`;
}

export function factorySwitchPath(factory: FactoryProject, location: { pathname: string; hash: string }): string {
  const homePath = factoryHomePath(factory);
  const factoryRouteSuffix = /^\/factories\/[^/]+(\/.*)?$/.exec(location.pathname)?.[1] ?? '';

  if (factoryRouteSuffix && !PRESERVED_FACTORY_ROUTE.test(factoryRouteSuffix)) return `${homePath}/overview`;

  return `${homePath}${factoryRouteSuffix}${location.hash}`;
}
