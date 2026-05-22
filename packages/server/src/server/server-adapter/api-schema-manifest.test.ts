import { describe, expect, it } from 'vitest';
import { buildApiSchemaManifest } from './api-schema-manifest';

const apiSchemaManifest = buildApiSchemaManifest();
const routeKeys = apiSchemaManifest.routes.map(route => `${route.method} ${route.path}`);

describe('apiSchemaManifest', () => {
  it('includes route contracts required by the mastra api command tree', () => {
    expect(routeKeys).toEqual(
      expect.arrayContaining([
        'GET /agents',
        'GET /agents/:agentId',
        'POST /agents/:agentId/generate',
        'GET /workflows',
        'GET /workflows/:workflowId',
        'POST /workflows/:workflowId/start-async',
        'GET /workflows/:workflowId/runs',
        'GET /workflows/:workflowId/runs/:runId',
        'POST /workflows/:workflowId/resume-async',
        'POST /workflows/:workflowId/runs/:runId/cancel',
        'GET /tools',
        'GET /tools/:toolId',
        'POST /tools/:toolId/execute',
        'GET /mcp/v0/servers',
        'GET /mcp/v0/servers/:id',
        'GET /mcp/:serverId/tools',
        'GET /mcp/:serverId/tools/:toolId',
        'POST /mcp/:serverId/tools/:toolId/execute',
        'GET /memory/threads',
        'GET /memory/threads/:threadId',
        'POST /memory/threads',
        'PATCH /memory/threads/:threadId',
        'DELETE /memory/threads/:threadId',
        'GET /memory/threads/:threadId/messages',
        'GET /memory/search',
        'GET /memory/threads/:threadId/working-memory',
        'POST /memory/threads/:threadId/working-memory',
        'GET /memory/status',
        'GET /observability/traces',
        'GET /observability/traces/:traceId',
        'GET /observability/logs',
        'POST /observability/scores',
        'GET /observability/scores',
        'GET /observability/scores/:scoreId',
        'GET /datasets',
        'POST /datasets',
        'GET /datasets/:datasetId',
        'GET /datasets/:datasetId/items',
        'GET /datasets/:datasetId/experiments',
        'POST /datasets/:datasetId/experiments',
        'GET /datasets/:datasetId/experiments/:experimentId',
        'GET /datasets/:datasetId/experiments/:experimentId/results',
      ]),
    );
  });

  it('derives the manifest from registered JSON route contracts', () => {
    expect(routeKeys).toContain('GET /agents/:agentId/voice/speakers');
    expect(routeKeys).toContain('GET /auth/me');
    expect(apiSchemaManifest.routes.every(route => route.responseType === 'json')).toBe(true);
    expect(routeKeys.some(key => key.includes('/stream'))).toBe(false);
  });

  it('infers response shape metadata for deterministic CLI normalization', () => {
    const listAgents = apiSchemaManifest.routes.find(route => route.method === 'GET' && route.path === '/agents');
    expect(listAgents?.responseShape).toEqual({ kind: 'record' });

    const listRuns = apiSchemaManifest.routes.find(
      route => route.method === 'GET' && route.path === '/workflows/:workflowId/runs',
    );
    expect(listRuns?.responseShape).toMatchObject({ kind: 'object-property', listProperty: 'runs' });

    const getAgent = apiSchemaManifest.routes.find(
      route => route.method === 'GET' && route.path === '/agents/:agentId',
    );
    expect(getAgent?.responseShape).toEqual({ kind: 'single' });
  });

  it('converts path, query, and body route schemas to JSON Schema', () => {
    const getAgent = apiSchemaManifest.routes.find(
      route => route.method === 'GET' && route.path === '/agents/:agentId',
    );
    expect(getAgent?.pathParamSchema?.type).toBe('object');
    expect(getAgent?.pathParamSchema?.properties).toHaveProperty('agentId');

    const listThreads = apiSchemaManifest.routes.find(
      route => route.method === 'GET' && route.path === '/memory/threads',
    );
    expect(listThreads?.queryParamSchema?.type).toBe('object');
    expect(listThreads?.queryParamSchema?.properties).toBeDefined();

    const executeTool = apiSchemaManifest.routes.find(
      route => route.method === 'POST' && route.path === '/tools/:toolId/execute',
    );
    expect(executeTool?.bodySchema?.type).toBe('object');
    expect(executeTool?.pathParamSchema?.properties).toHaveProperty('toolId');
  });
});
