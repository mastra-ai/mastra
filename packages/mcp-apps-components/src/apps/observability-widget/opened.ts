import { dashboardWidgetSchema } from '@mastra/core/storage/dashboards';
import type { DashboardWidget } from '@mastra/core/storage/dashboards';
import type { DashboardEnvironment } from '@mastra/playground-ui/domains/dashboards';
import { z } from 'zod';

const HOUR_MS = 60 * 60 * 1000;

/** The windows the widget can show, ending when it opens; the same presets as Studio's metrics. */
const PRESET_HOURS = { '24h': 24, '3d': 72, '7d': 168, '14d': 336, '30d': 720 } as const;

export type ObservabilityWidgetPreset = keyof typeof PRESET_HOURS;

/**
 * What the opening tool returns as `structuredContent`: one stored dashboard widget and the window
 * to show it over (`24h` when missing).
 */
const openedSchema = z.object({
  widget: z.unknown(),
  datePreset: z.enum(Object.keys(PRESET_HOURS) as [ObservabilityWidgetPreset]).default('24h'),
});

export type Opened =
  | { status: 'ready'; widget: DashboardWidget; datePreset: ObservabilityWidgetPreset; env: DashboardEnvironment }
  | { status: 'error'; message: string };

/** The window, filters and gates the widget is drawn over, frozen at `now`. */
export function environment(preset: ObservabilityWidgetPreset, now: number): DashboardEnvironment {
  const window = { start: new Date(now - PRESET_HOURS[preset] * HOUR_MS), end: new Date(now) };
  return {
    window,
    filters: { timestamp: window },
    comparisonLabel: `vs previous ${preset}`,
    // The server decides: trace and span aggregates it can't answer fail on the widget itself.
    gates: { trace: { status: 'ready' }, span: { status: 'ready' } },
  };
}

/** Reads the opening tool's result; a bad one becomes a message rather than a broken app. */
export function readOpened(structuredContent: unknown, now: number): Opened {
  const opened = openedSchema.safeParse(structuredContent);
  if (!opened.success) return { status: 'error', message: 'The tool returned no widget to show.' };
  const widget = dashboardWidgetSchema.safeParse(opened.data.widget);
  if (!widget.success) return { status: 'error', message: `The widget is invalid: ${widget.error.message}` };
  const { datePreset } = opened.data;
  return { status: 'ready', widget: widget.data, datePreset, env: environment(datePreset, now) };
}
