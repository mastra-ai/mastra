import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';

const factoryId = 'knowledge-latency';
const timestamp = '2026-10-08T07:00:00.000Z';

/** Dense deterministic network data; the test runs the production Factory SPA. */
function graphFixture(count) {
  const nodes = Array.from({ length: count }, (_, index) => ({
    id: `node-${index}`,
    name: index % 9 === 0 ? `Domain ${index / 9}` : `Service ${index}`,
    kind: index % 9 === 0 ? 'domain' : 'service',
    description: `Architecture and decisions for service ${index}.`,
    scope: ['org:latency', `resource:${factoryId}`],
    rung: index % 9 === 0 ? 'org' : 'resource',
    pinned: false,
    recordCount: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const records = nodes.flatMap((node, index) => {
    const hub = Math.floor(index / 9) * 9;
    const next = hub + ((index + 1) % 9);
    const target = nodes[next] ?? nodes[0];
    return [
      {
        id: `record-${index}`,
        nodeIds: [...new Set([node.id, nodes[hub].id, target.id])],
        pinned: index % 13 === 0,
        text: `[[${node.name}]] works with [[${target.name}]].`,
      },
      { id: `note-${index}`, nodeIds: [node.id], pinned: false, text: `Decisions for ${node.name}.` },
      ...(index % 9 === 0 && index + 9 < count
        ? [
            {
              id: `bridge-${index}`,
              nodeIds: [node.id, nodes[index + 9].id],
              pinned: false,
              text: 'Shared interfaces.',
            },
          ]
        : []),
    ];
  });
  return {
    view: 'project',
    nodes,
    records,
    edges: [],
    truncated: false,
    outOfWindow: [],
    unresolvedCapped: { count: 0, names: [] },
    pinCensus: { resource: records.filter(record => record.pinned).length, thread: null },
    version: `latency-${count}`,
  };
}

function apiFixture(path, graph) {
  if (path === '/auth/me')
    return { authEnabled: true, authenticated: true, user: { userId: 'latency', name: 'Performance test' } };
  if (path === '/web/config/features') return { knowledge: true };
  if (path === '/web/factory/projects') return { projects: [{ id: factoryId, name: 'Latency test' }] };
  if (path.endsWith('/knowledge/graph')) return graph;
  if (path.includes('/knowledge/nodes/')) {
    const node = graph.nodes.find(node => node.id === path.split('/').at(-1));
    if (!node) return undefined;
    return {
      node: { ...node, content: node.description },
      records: graph.records
        .filter(record => record.nodeIds.includes(node.id))
        .map(record => ({
          ...record,
          node: node.id,
          relation: record.nodeIds[0] === node.id ? 'owned' : 'mentions',
          scope: node.scope,
          rung: node.rung,
          capturedAt: timestamp,
          sourceThreadId: 'latency-session',
          metadata: { reason: 'Preserve implementation context.' },
        })),
    };
  }
  if (path.endsWith('/attention'))
    return {
      items: [],
      kinds: Object.fromEntries(
        ['automation-failed', 'automation-proposed', 'mention', 'activity', 'supervisor-finding', 'agent-waiting'].map(
          kind => [kind, { open: 0, unread: 0, latest: null }],
        ),
      ),
      hasMore: false,
    };
  if (path.endsWith('/status'))
    return { enabled: false, connected: false, installations: [], reason: 'missing_config' };
  if (path.endsWith('/permissions')) return {};
  const collections = [
    'source-control-connections',
    'boards',
    'active-runs',
    'work-records',
    'work-items',
    'decisions',
    'sessions',
    'subscriptions',
    'models',
    'providers',
  ];
  const keys = [
    'connections',
    'boards',
    'runs',
    'workRecords',
    'workItems',
    'decisions',
    'sessions',
    'subscriptions',
    'models',
    'providers',
  ];
  const index = collections.findIndex(collection => path.endsWith(`/${collection}`));
  return index === -1 ? undefined : { [keys[index]]: [] };
}

export async function startKnowledgeFixtureServer(dist) {
  const graphs = new Map([180, 240].map(count => [count, graphFixture(count)]));
  const server = createServer(async (request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname;
    if (path.endsWith('/feed-events')) {
      response.writeHead(200, { 'Content-Type': 'text/event-stream' });
      response.write(': connected\n\n');
      return;
    }
    if (/^\/(web|api|auth)\//.test(path)) {
      const count = Number(request.headers.cookie?.match(/latency-nodes=(\d+)/)?.[1]) || 180;
      const payload = apiFixture(path, graphs.get(count) ?? graphs.get(180));
      // Cold details must not block camera motion or move the header when resolved.
      if (path.includes('/knowledge/nodes/')) await new Promise(resolve => setTimeout(resolve, 180));
      response.writeHead(payload ? 200 : 404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(payload ?? { error: 'not_found' }));
      return;
    }
    const asset = resolve(dist, `.${path}`);
    const mime = { '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
    try {
      if (!asset.startsWith(dist + sep)) throw new Error('Invalid asset path');
      const body = await readFile(asset);
      response.writeHead(200, { 'Content-Type': mime[extname(asset)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      if (extname(path)) {
        response.writeHead(404);
        response.end();
        return;
      }
      const html = await readFile(resolve(dist, 'index.html'), 'utf8');
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(html.replace('<head>', '<head><script>window.__MASTRACODE_CONFIG__={authEnabled:true}</script>'));
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}/factories/${factoryId}/knowledge`,
    close: () =>
      new Promise(resolve => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  };
}
