import type { KnowledgeRung } from '../../services/knowledge';

/** Shared scope colors for the canvas, minimap, legend, and detail badges. */
export const knowledgeScopes = {
  org: {
    tone: 'purple',
    color: 'var(--chart-purple)',
    filterClass: 'border-badge-purple-edge bg-badge-purple-strong text-badge-purple-foreground',
  },
  resource: {
    tone: 'blue',
    color: 'var(--chart-blue)',
    filterClass: 'border-badge-blue-edge bg-badge-blue-strong text-badge-blue-foreground',
  },
  thread: {
    tone: 'cyan',
    color: 'var(--chart-cyan)',
    filterClass: 'border-badge-cyan-edge bg-badge-cyan-strong text-badge-cyan-foreground',
  },
} as const satisfies Record<KnowledgeRung, { tone: string; color: string; filterClass: string }>;
