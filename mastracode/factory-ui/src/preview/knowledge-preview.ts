import type { Plugin } from 'vite';
import type { KnowledgeGraphPayload, KnowledgeNodePayload } from '../ui/domains/factory/services/knowledge';

const factoryId = 'knowledge-preview';
const groups = [
  [
    'Platform',
    'API Gateway',
    'Identity Service',
    'Permissions',
    'Rate Limits',
    'Service Registry',
    'API Contracts',
    'Webhooks',
    'Audit Trail',
  ],
  [
    'Delivery',
    'Deploy Runbook',
    'Release Pipeline',
    'Feature Flags',
    'Rollback Policy',
    'Preview Environments',
    'Build Cache',
    'Change Review',
    'Versioning',
  ],
  [
    'Data',
    'Postgres',
    'Query Planner',
    'Migrations',
    'Vector Index',
    'Event Stream',
    'Data Retention',
    'Backups',
    'Schema Registry',
  ],
  [
    'Agents',
    'Tool Registry',
    'Memory',
    'Supervisor',
    'Evaluations',
    'Prompt Library',
    'Guardrails',
    'Workflows',
    'Observability',
  ],
  [
    'Product',
    'Factory',
    'Knowledge Graph',
    'Playground',
    'Design Tokens',
    'Onboarding',
    'Search',
    'Notifications',
    'Accessibility',
  ],
  [
    'Operations',
    'Incident Response',
    'Health Checks',
    'Error Budget',
    'Tracing',
    'Metrics',
    'On-call',
    'Capacity Planning',
    'Security Review',
  ],
];

/** Deterministic sample data, served only by the explicitly enabled Vite plugin. */
export function createKnowledgePreview(count = 72, threadId?: string): KnowledgeGraphPayload {
  const timestamp = '2026-10-08T07:00:00.000Z';
  const nodes: KnowledgeGraphPayload['nodes'] = Array.from({ length: count }, (_, index) => {
    const group = groups[Math.floor(index / 9) % groups.length]!;
    const cycle = Math.floor(index / 54);
    const name = `${group[index % 9]}${cycle ? ` ${cycle + 1}` : ''}`;
    const rung = threadId && index % 4 === 0 ? 'thread' : index % 9 === 0 ? 'org' : 'resource';
    return {
      id: `node-${index}`,
      name,
      rung,
      kind: index % 9 === 0 ? 'domain' : index % 3 === 0 ? 'document' : 'service',
      description: `${name} belongs to ${group[0]}. Architecture, decisions, and operational context captured by factory sessions.`,
      scope: ['org:preview', `resource:${factoryId}`, ...(rung === 'thread' ? [`thread:${threadId}`] : [])],
      pinned: false,
      recordCount: 4,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  const records: KnowledgeGraphPayload['records'] = nodes.flatMap((node, index) => {
    const hub = Math.floor(index / 9) * 9;
    const next = hub + ((index + 1) % 9);
    const target = nodes[next] ?? nodes[0]!;
    return [
      {
        id: `record-${index}`,
        nodeIds: [...new Set([node.id, nodes[hub]!.id, target.id])],
        pinned: index % 13 === 0,
        text: `[[${node.name}]] works with [[${target.name}]]. Changes require a contract review and verification in preview.`,
      },
      {
        id: `note-${index}`,
        nodeIds: [node.id],
        pinned: false,
        text: `${node.name}: keep operational context close to the implementation.`,
      },
      ...(index % 9 === 0 && index + 9 < count
        ? [
            {
              id: `bridge-${index}`,
              nodeIds: [node.id, nodes[index + 9]!.id],
              pinned: false,
              text: `[[${node.name}]] shares interfaces with [[${nodes[index + 9]!.name}]].`,
            },
          ]
        : []),
    ];
  });
  return {
    view: threadId ? 'thread' : 'project',
    threadId,
    nodes,
    records,
    edges: [],
    truncated: false,
    outOfWindow: [],
    unresolvedCapped: { count: 0, names: [] },
    pinCensus: { resource: records.filter(record => record.pinned).length, thread: threadId ? 2 : null },
    version: `preview-${count}`,
  };
}

export function knowledgePreviewPlugin(): Plugin {
  return {
    name: 'knowledge-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url ?? '/', 'http://localhost');
        if (url.pathname === '/__knowledge-preview') {
          const count = Math.max(9, Math.min(240, Number(url.searchParams.get('nodes')) || 72));
          response.setHeader('Set-Cookie', `knowledge-preview-nodes=${count}; Path=/; SameSite=Lax`);
          response.writeHead(302, { Location: `/factories/${factoryId}/knowledge` });
          response.end();
          return;
        }
        if (!/^\/(web|api|auth)\//.test(url.pathname)) return next();
        if (request.method !== 'GET') {
          response.writeHead(405, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ message: 'The knowledge preview is read-only.' }));
          return;
        }
        const cookieCount = Number(request.headers.cookie?.match(/knowledge-preview-nodes=(\d+)/)?.[1]) || 72;
        const graph = createKnowledgePreview(
          Math.max(9, Math.min(240, cookieCount)),
          url.searchParams.get('threadId') ?? undefined,
        );
        const path = url.pathname;
        let payload: unknown;
        if (path.endsWith('/feed-events')) {
          response.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
          response.write(': preview connected\n\n');
          return;
        }
        if (path === '/auth/me')
          payload = { authEnabled: true, authenticated: true, user: { userId: 'preview', name: 'Design preview' } };
        else if (path === '/web/config/features') payload = { knowledge: true };
        else if (path === '/web/factory/projects')
          payload = { projects: [{ id: factoryId, name: 'Knowledge Studio' }] };
        else if (path.endsWith('/source-control-connections')) payload = { connections: [] };
        else if (path.endsWith('/knowledge/graph')) payload = graph;
        else if (path.includes('/knowledge/nodes/')) {
          const node = graph.nodes.find(entry => entry.id === decodeURIComponent(path.split('/').at(-1)!));
          if (!node) {
            response.writeHead(404);
            response.end();
            return;
          }
          const detail: KnowledgeNodePayload = {
            node: { ...node, content: node.description ?? '' },
            records: graph.records
              .filter(record => record.nodeIds.includes(node.id))
              .map(record => ({
                id: record.id,
                node: node.id,
                relation: record.nodeIds[0] === node.id ? 'owned' : 'mentions',
                text: record.text,
                scope: node.scope,
                rung: node.rung,
                sourceThreadId: 'preview-session',
                capturedAt: node.updatedAt,
                pinned: record.pinned,
                metadata: {
                  reason: 'Captured during implementation review to preserve the decision and its supporting context.',
                },
              })),
          };
          payload = detail;
        } else if (path.endsWith('/boards'))
          payload = {
            boards: [
              { id: 'work', title: 'Work', initialPhase: 'intake', phases: [] },
              { id: 'review', title: 'Review', initialPhase: 'intake', phases: [] },
            ],
          };
        else if (path.endsWith('/attention'))
          payload = {
            items: [],
            kinds: Object.fromEntries(
              [
                'automation-failed',
                'automation-proposed',
                'mention',
                'activity',
                'supervisor-finding',
                'agent-waiting',
              ].map(kind => [kind, { open: 0, unread: 0, latest: null }]),
            ),
            hasMore: false,
          };
        else if (path.endsWith('/active-runs')) payload = { runs: [] };
        else if (path.endsWith('/work-records')) payload = { workRecords: [] };
        else if (path.endsWith('/work-items')) payload = { workItems: [] };
        else if (path.endsWith('/decisions')) payload = { decisions: [] };
        else if (path.endsWith('/permissions')) payload = {};
        else if (path.endsWith('/sessions')) payload = { sessions: [] };
        else if (path.endsWith('/subscriptions')) payload = { subscriptions: [] };
        else if (path.endsWith('/status'))
          payload = { enabled: false, connected: false, installations: [], reason: 'missing_config' };
        else if (path.endsWith('/models')) payload = { models: [] };
        else if (path.endsWith('/providers')) payload = { providers: [] };
        else {
          response.writeHead(404, { 'Content-Type': 'application/json' });
          response.end(JSON.stringify({ error: 'not_found' }));
          return;
        }
        response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        response.end(JSON.stringify(payload));
      });
    },
  };
}
