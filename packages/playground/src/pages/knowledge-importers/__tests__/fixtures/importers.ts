import type {
  KnowledgeImporterRunEvent,
  KnowledgeImporterRunSummary,
  KnowledgeImporterSummary,
  ListKnowledgeImportersResponse,
} from '@mastra/client-js';

export const NOTION_KEY = 'notion:conn_notion';

export const buildNotionSummary = (overrides: Partial<KnowledgeImporterSummary> = {}): KnowledgeImporterSummary => ({
  key: NOTION_KEY,
  importerId: 'notion',
  label: 'Notion',
  description: 'Pages from each teamspace; each teamspace lands in its own container.',
  settings: {
    importerId: 'notion',
    enabled: true,
    schedule: null,
    options: { teamspaces: ['Engineering'] },
    version: 3,
    updatedAt: '2026-10-29T12:00:00.000Z',
    updatedBy: 'jamie@example.com',
    source: 'saved',
  },
  optionsSchema: [
    {
      key: 'teamspaces',
      label: 'Teamspaces',
      type: 'list',
      help: 'Only pages in these teamspaces are imported.',
      envVar: 'NOTION_TEAMSPACES',
    },
  ],
  effectiveSchedule: '*/15 * * * *',
  connection: { id: 'conn_notion', status: 'ok', accountName: 'Acme workspace' },
  lastRun: {
    id: 'run_prev',
    importerId: 'notion',
    kind: 'scheduled',
    status: 'succeeded',
    startedAt: '2026-10-29T12:00:00.000Z',
    completedAt: '2026-10-29T12:00:42.000Z',
    counts: { nodesCreated: 4, nodesUpdated: 2 },
  },
  ...overrides,
});

/** One Linear entry per linked connection; the project links several Linear accounts. */
export const buildLinearSummary = (
  connectionId: string,
  accountName: string,
  overrides: Partial<KnowledgeImporterSummary> = {},
): KnowledgeImporterSummary => ({
  key: `linear:${connectionId}`,
  importerId: 'linear',
  label: 'Linear',
  settings: {
    importerId: 'linear',
    enabled: false,
    schedule: null,
    options: {},
    version: 0,
    updatedAt: null,
    updatedBy: null,
    source: 'env',
  },
  optionsSchema: [],
  effectiveSchedule: null,
  connection: { id: connectionId, status: 'ok', accountName },
  lastRun: null,
  ...overrides,
});

export const PLATFORM_CONNECT_URL = 'https://projects.mastra.ai/acme/knowledge/settings/connect';

export const buildListImportersResponse = (
  summaries: KnowledgeImporterSummary[],
  canWrite = true,
  connectUrl: string | null = PLATFORM_CONNECT_URL,
): ListKnowledgeImportersResponse => ({
  summaries,
  canWrite,
  connectUrl,
});

export const buildRun = (overrides: Partial<KnowledgeImporterRunSummary> = {}): KnowledgeImporterRunSummary => ({
  id: 'run_dry',
  importerId: 'notion',
  kind: 'dry-run',
  status: 'running',
  startedAt: '2026-10-29T13:00:00.000Z',
  completedAt: null,
  ...overrides,
});

export const buildNotionPreview = (overrides: Partial<KnowledgeImporterRunSummary> = {}): KnowledgeImporterRunSummary =>
  buildRun({
    status: 'succeeded',
    completedAt: '2026-10-29T13:00:05.000Z',
    counts: { nodesCreated: 12, recordsWritten: 30, skipped: 3 },
    skipped: [{ reason: 'notion-private-page', label: 'Private Notion pages are never imported', count: 3 }],
    preview: {
      destinations: [
        {
          scope: 'notion:org',
          label: 'Notion · Wiki',
          placement: 'org-wide',
          nodes: 5,
          records: 9,
          sampleTitles: ['Onboarding'],
        },
        {
          scope: 'notion:teamspace:engineering',
          label: 'Engineering',
          placement: 'container',
          nodes: 7,
          records: 21,
          sampleTitles: ['Release checklist', 'On-call runbook'],
        },
      ],
      truncated: false,
    },
    ...overrides,
  });

const RUN_START_MS = Date.parse('2026-10-29T13:00:00.000Z');

/** One log line, `afterMs` after the fixture runs start. */
export const buildRunEvent = (
  seq: number,
  message: string,
  overrides: Partial<KnowledgeImporterRunEvent> & { afterMs?: number } = {},
): KnowledgeImporterRunEvent => {
  const { afterMs = (seq - 1) * 500, ...rest } = overrides;
  return {
    seq,
    at: new Date(RUN_START_MS + afterMs).toISOString(),
    level: 'info',
    type: 'item',
    message,
    ...rest,
  };
};
