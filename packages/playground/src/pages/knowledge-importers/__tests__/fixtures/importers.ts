import type {
  KnowledgeImporterRunSummary,
  KnowledgeImporterSummary,
  ListKnowledgeImporterConnectionsResponse,
  ListKnowledgeImportersResponse,
} from '@mastra/client-js';

export const buildNotionSummary = (overrides: Partial<KnowledgeImporterSummary> = {}): KnowledgeImporterSummary => ({
  importerId: 'notion',
  label: 'Notion',
  settings: {
    importerId: 'notion',
    enabled: true,
    schedule: null,
    connectionId: null,
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
  connection: { status: 'ok', connectionId: 'conn_notion' },
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

export const buildSlackSummary = (): KnowledgeImporterSummary => ({
  importerId: 'slack',
  label: 'Slack',
  settings: {
    importerId: 'slack',
    enabled: false,
    schedule: null,
    connectionId: null,
    options: {},
    version: 0,
    updatedAt: null,
    updatedBy: null,
    source: 'env',
  },
  optionsSchema: [],
  effectiveSchedule: null,
  connection: { status: 'none', connectionId: null },
  lastRun: null,
});

export const buildListImportersResponse = (summaries: KnowledgeImporterSummary[]): ListKnowledgeImportersResponse => ({
  summaries,
});

export const notionConnections: ListKnowledgeImporterConnectionsResponse = {
  connections: [{ id: 'conn_notion', provider: 'notion', accountName: 'Acme workspace', status: 'active' }],
};

export const buildRun = (overrides: Partial<KnowledgeImporterRunSummary> = {}): KnowledgeImporterRunSummary => ({
  id: 'run_dry',
  importerId: 'notion',
  kind: 'dry-run',
  status: 'running',
  startedAt: '2026-10-29T13:00:00.000Z',
  completedAt: null,
  ...overrides,
});
