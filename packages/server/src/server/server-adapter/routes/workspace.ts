/**
 * Workspace Routes
 *
 * All routes for workspace operations under /api/workspaces/*
 */

import {
  LIST_WORKSPACES_ROUTE,
  GET_WORKSPACE_ROUTE,
  WORKSPACE_FS_ROUTES,
  WORKSPACE_SEARCH_ROUTES,
  WORKSPACE_SKILLS_ROUTES,
  WORKSPACE_SKILLS_SH_ROUTES,
} from '../../handlers/workspace';
import type { ServerRoute } from '.';

export const WORKSPACE_ROUTES: ServerRoute<any, any, any>[] = [
  // List all workspaces route (at /api/workspaces)
  LIST_WORKSPACES_ROUTE,

  // Get workspace route (at /api/workspaces/:workspaceId)
  GET_WORKSPACE_ROUTE,

  // Filesystem routes (at /api/workspaces/:workspaceId/fs/*)
  ...WORKSPACE_FS_ROUTES,

  // Search routes (at /api/workspaces/:workspaceId/search, /api/workspaces/:workspaceId/index)
  ...WORKSPACE_SEARCH_ROUTES,

  // Skills routes (search must come before parameterized routes)
  ...WORKSPACE_SKILLS_ROUTES,

  // skills.sh proxy routes (at /api/workspaces/:workspaceId/skills-sh/*)
  ...WORKSPACE_SKILLS_SH_ROUTES,
];
