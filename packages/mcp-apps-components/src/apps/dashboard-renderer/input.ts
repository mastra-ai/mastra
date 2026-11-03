import type { DashboardDefinition } from '@mastra/client-js';
import type { DatePreset } from '@mastra/playground-ui/domains/metrics';
import { z } from 'zod';
import { mastraConnectionSchema } from '../../runtime/connection';

const PRESETS = ['24h', '3d', '7d', '14d', '30d'] as const satisfies readonly DatePreset[];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * What the tool linked to the dashboard app returns as `structuredContent`. The definition
 * is only checked to be an object here: the renderer validates it and reports a bad widget
 * on that widget alone, so one broken widget doesn't blank the whole dashboard.
 */
export const dashboardRendererInputSchema = mastraConnectionSchema.extend({
  definition: z.custom<DashboardDefinition>(isRecord, 'Expected a dashboard definition object'),
  scope: z.enum(['org', 'project']).default('project'),
  preset: z.enum(PRESETS).default('24h'),
});

export type DashboardRendererInput = z.output<typeof dashboardRendererInputSchema>;
