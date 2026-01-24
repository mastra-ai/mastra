import type { AdminServerRoute } from '../types';
import { AUTH_ROUTES } from './auth';
import { TEAM_ROUTES } from './teams';
import { PROJECT_ROUTES } from './projects';
import { SOURCE_ROUTES } from './sources';
import { DEPLOYMENT_ROUTES } from './deployments';
import { BUILD_ROUTES } from './builds';
import { SERVER_ROUTES } from './servers';
import { OBSERVABILITY_ROUTES } from './observability';
import { ADMIN_ROUTES } from './admin';

/**
 * All admin server routes aggregated.
 */
export const ADMIN_SERVER_ROUTES: AdminServerRoute[] = [
  ...AUTH_ROUTES,
  ...TEAM_ROUTES,
  ...PROJECT_ROUTES,
  ...SOURCE_ROUTES,
  ...DEPLOYMENT_ROUTES,
  ...BUILD_ROUTES,
  ...SERVER_ROUTES,
  ...OBSERVABILITY_ROUTES,
  ...ADMIN_ROUTES,
];

// Re-export route arrays for selective usage
export {
  AUTH_ROUTES,
  TEAM_ROUTES,
  PROJECT_ROUTES,
  SOURCE_ROUTES,
  DEPLOYMENT_ROUTES,
  BUILD_ROUTES,
  SERVER_ROUTES,
  OBSERVABILITY_ROUTES,
  ADMIN_ROUTES,
};

// Re-export types
export type { AdminServerRoute } from '../types';
