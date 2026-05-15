/**
 * Legacy routes that are deprecated but still exist in deployer for backward compatibility.
 * These routes should not be used in new code and will be removed in a future version.
 */

import { GENERATE_LEGACY_ROUTE, STREAM_GENERATE_LEGACY_ROUTE } from '../../handlers/agents';
import { STREAM_LEGACY_WORKFLOW_ROUTE, OBSERVE_STREAM_LEGACY_WORKFLOW_ROUTE } from '../../handlers/workflows';

export const LEGACY_ROUTES = [
  // ============================================================================
  // Legacy Agent Routes
  // ============================================================================
  GENERATE_LEGACY_ROUTE,
  STREAM_GENERATE_LEGACY_ROUTE,

  // ============================================================================
  // Legacy Workflow Routes
  // ============================================================================
  STREAM_LEGACY_WORKFLOW_ROUTE,
  OBSERVE_STREAM_LEGACY_WORKFLOW_ROUTE,
] as const;
