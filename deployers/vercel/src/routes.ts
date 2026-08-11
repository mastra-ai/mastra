type VercelRoutesOptions = {
  studio: boolean;
  /** Studio's top-level route segments, read from the Studio build's routes-manifest.json. */
  studioRouteRoots?: string[];
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function getVercelRoutes({ studio, studioRouteRoots = [] }: VercelRoutesOptions) {
  if (!studio) {
    return [{ src: '/(.*)', dest: '/' }];
  }

  // Studio owns a known set of SPA paths; everything else belongs to the server function.
  // The function has to be the catch-all because custom `registerApiRoute()` paths are mounted
  // at the root of the server (never under `apiPrefix`), so the CDN cannot tell them apart from
  // an unknown path — an SPA catch-all would swallow every one of them.
  const spaRoots = studioRouteRoots.map(escapeRegExp).join('|');

  return [
    { src: '^/$', dest: '/index.html' },
    ...(spaRoots ? [{ src: `^/(?:${spaRoots})(?:/.*)?$`, dest: '/index.html' }] : []),
    { handle: 'filesystem' as const },
    { src: '/(.*)', dest: '/' },
  ];
}
