import type { MountedMastraCode } from '@mastra/code-sdk';
import type { ApiRoute } from '@mastra/core/server';

import { buildConfigRoutes } from './config-routes.js';
import { buildFsRoutes } from './fs-routes.js';

export interface CoreWebApiRoutesDeps {
  controller: MountedMastraCode['controller'];
  authStorage: MountedMastraCode['authStorage'];
  fsRoot?: string;
  additionalProjectRoots?: () => readonly string[];
  allowPersonalProviderCredentials?: boolean;
}

export function assembleCoreWebApiRoutes(deps: CoreWebApiRoutesDeps): ApiRoute[] {
  return [
    ...buildFsRoutes({ root: deps.fsRoot, additionalRoots: deps.additionalProjectRoots }),
    ...buildConfigRoutes({
      controller: deps.controller,
      authStorage: deps.authStorage,
      credentialManagementEnabled: deps.allowPersonalProviderCredentials !== false,
    }),
  ];
}
