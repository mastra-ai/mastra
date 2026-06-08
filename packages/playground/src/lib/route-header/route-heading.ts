import type { CrumbDef } from './types';

function nodeHeading(def: CrumbDef) {
  if (!('node' in def)) return undefined;
  return typeof def.node === 'string' ? def.node : undefined;
}

export function getRouteHeaderHeading(crumbs: CrumbDef[]) {
  for (let i = crumbs.length - 1; i >= 0; i -= 1) {
    const def = crumbs[i];
    const heading = def.heading ?? ('label' in def ? def.label : nodeHeading(def));
    const normalizedHeading = heading?.trim();
    if (normalizedHeading) return normalizedHeading;
  }

  return undefined;
}
