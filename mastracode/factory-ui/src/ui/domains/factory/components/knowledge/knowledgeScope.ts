import type { KnowledgeRung } from '../../services/knowledge';

/** Shared scope colors for the canvas, minimap, legend, and detail badges. */
export const knowledgeScopes = {
  org: { label: 'Org', tone: 'purple', color: 'var(--chart-purple)', dot: 'bg-chart-purple' },
  resource: { label: 'Project', tone: 'blue', color: 'var(--chart-blue)', dot: 'bg-chart-blue' },
  thread: { label: 'Session', tone: 'cyan', color: 'var(--chart-cyan)', dot: 'bg-chart-cyan' },
} as const satisfies Record<KnowledgeRung, { label: string; tone: string; color: string; dot: string }>;
