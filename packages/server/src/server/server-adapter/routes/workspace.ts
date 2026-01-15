/**
 * Workspace Routes
 *
 * All routes for workspace operations under /api/workspace/*
 */

import {
  WORKSPACE_INFO_ROUTE,
  WORKSPACE_FS_ROUTES,
  WORKSPACE_SEARCH_ROUTES,
  WORKSPACE_SKILLS_ROUTES,
} from '../../handlers/workspace';
import type { ServerRoute } from '.';

export const WORKSPACE_ROUTES: ServerRoute<any, any, any>[] = [
  // Info route (must come first to avoid /api/workspace being matched by parameterized routes)
  WORKSPACE_INFO_ROUTE,

  // Filesystem routes
  ...WORKSPACE_FS_ROUTES,

  // Search routes
  ...WORKSPACE_SEARCH_ROUTES,

  // Skills routes (search must come before parameterized routes)
  ...WORKSPACE_SKILLS_ROUTES,
];
