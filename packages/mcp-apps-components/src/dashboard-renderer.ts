import type { z } from 'zod';
// Built by scripts/build-apps.ts, inlined by tsdown.config.ts.
import html from '../apps-dist/dashboard-renderer.html?raw';
import { dashboardContract } from './apps/dashboard-renderer/contract';
import type { dashboardInputSchema } from './apps/dashboard-renderer/input';
import { defineMcpAppUi } from './define-mcp-app-ui';

export { dashboardInputSchema } from './apps/dashboard-renderer/input';
export {
  DASHBOARD_PIN_REQUEST_CONTEXT_KEY,
  DASHBOARD_PINNED_WIDGETS_CONTEXT_KEY,
  dashboardPinnedWidgetSchema,
  dashboardPinnedWidgetsSchema,
} from './apps/dashboard-renderer/pin';
export type { DashboardPinnedWidget } from './apps/dashboard-renderer/pin';

/** What the tool that opens the dashboard returns. */
export type DashboardInput = z.input<typeof dashboardInputSchema>;

/**
 * Renders a Mastra dashboard definition with live metrics, read from Mastra's observability routes.
 * Build an app from it with `createMcpApp` from `@mastra/mcp-apps-components`.
 */
export const dashboardUi = defineMcpAppUi({ ...dashboardContract, html });
