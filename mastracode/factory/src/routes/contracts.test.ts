import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  buildFactoryApiCliArtifact,
  extractSchemaProperties,
  factorySchemaToJsonSchema,
  generateFactoryApiCliRouteMetadata,
  inferFactoryResponseShape,
} from '../../scripts/generate-api-cli-route-metadata.js';
import { buildAttentionRoutes } from './attention.js';
import {
  createProjectBodySchema,
  createWorkItemBodySchema,
  FACTORY_ROUTE_CONTRACTS,
  transitionBodySchema,
  updateProjectBodySchema,
} from './contracts.js';
import { ProjectRoutes } from './projects.js';
import { buildSupervisorRoutes } from './supervisor.js';
import { WorkItemRoutes } from './work-items.js';

const projectId = '11111111-1111-4111-8111-111111111111';
const decisionId = '22222222-2222-4222-8222-222222222222';

function registeredFactoryRoutes() {
  const projects = new ProjectRoutes({
    auth: {},
    projects: {},
    sourceControl: {},
  } as never).routes();
  const workItems = {
    approveDeferredDecision: async () => null,
    dismissDeferredDecision: async () => null,
  };
  const work = new WorkItemRoutes({
    auth: {},
    audit: {},
    projects: {},
    workItems,
    comments: {},
    queueHealth: {},
    liveSessions: {},
  } as never).routes();
  const attention = buildAttentionRoutes({
    workItems: workItems as never,
    comments: {} as never,
    resolveProject: async () => ({}) as never,
  });
  const supervisor = buildSupervisorRoutes({
    workItems: workItems as never,
    resolveProject: async () => ({}) as never,
  });
  return [...projects, ...work, ...attention, ...supervisor];
}

describe('Factory route contracts', () => {
  it('matches every in-scope registered method and path', () => {
    const registered = new Set(registeredFactoryRoutes().map(route => `${route.method} ${route.path}`));
    for (const contract of Object.values(FACTORY_ROUTE_CONTRACTS)) {
      expect(registered, `${contract.method} ${contract.path}`).toContain(`${contract.method} ${contract.path}`);
    }
  });

  it('preserves normalized project and work-item request behavior', () => {
    expect(createProjectBodySchema.parse({ name: ' Factory ', description: '  ' })).toEqual({
      name: 'Factory',
      description: null,
    });
    expect(updateProjectBodySchema.safeParse({}).success).toBe(false);
    expect(updateProjectBodySchema.parse({ defaultModelId: '  ', autoRunEnabled: true })).toEqual({
      defaultModelId: null,
      autoRunEnabled: true,
    });
    expect(createWorkItemBodySchema.parse({ title: ' Card ', stages: ['intake'], ignored: true })).toEqual({
      title: 'Card',
      stages: ['intake'],
    });
    expect(createWorkItemBodySchema.safeParse({ title: 'Card', stages: ['intake', 'intake'] }).success).toBe(false);
  });

  it('preserves governed transition validation and normalization', () => {
    expect(
      transitionBodySchema.parse({
        board: 'work',
        stage: 'planning',
        expectedRevision: 2,
        requestId: decisionId,
        cause: ' Human move ',
      }),
    ).toEqual({
      board: 'work',
      stage: 'planning',
      expectedRevision: 2,
      ingress: { type: 'human', identity: decisionId },
      cause: 'Human move',
    });
    expect(transitionBodySchema.safeParse({ board: 'work', stage: 'planning', expectedRevision: 0 }).success).toBe(
      false,
    );
  });

  it('accepts representative successful response envelopes', () => {
    expect(
      FACTORY_ROUTE_CONTRACTS.projectList.responseSchema.safeParse({ projects: [{ id: projectId }] }).success,
    ).toBe(true);
    expect(
      FACTORY_ROUTE_CONTRACTS.workItemList.responseSchema.safeParse({
        workItems: [{ id: projectId }],
        runningSessionIds: ['session-1'],
      }).success,
    ).toBe(true);
    expect(
      FACTORY_ROUTE_CONTRACTS.attentionList.responseSchema.safeParse({
        items: [],
        openCount: 1,
        approvalCount: 0,
        unreadCount: 1,
        hasMore: false,
      }).success,
    ).toBe(true);
    expect(
      FACTORY_ROUTE_CONTRACTS.supervisorHealth.responseSchema.safeParse({
        checkedAt: new Date().toISOString(),
        findings: [],
        counts: { 'decision-failed': 0 },
      }).success,
    ).toBe(true);
  });
});

describe('Factory CLI metadata generator', () => {
  it('emits stable metadata, schemas, constraints, and inferred response shapes', () => {
    const first = buildFactoryApiCliArtifact();
    const second = buildFactoryApiCliArtifact();
    expect(first).toBe(second);
    expect(first).toContain('FACTORY_API_ROUTE_METADATA');
    expect(first).toContain('FACTORY_API_ROUTE_SCHEMAS');
    expect(first).toContain('"maxLength": 500');
    expect(first).toContain('"listProperty": "projects"');
  });

  it('resolves reused and optional array schemas for fields and response-shape inference', () => {
    const nested = z.object({ id: z.string().uuid() });
    const schema = factorySchemaToJsonSchema(
      z.object({
        items: z.array(nested).optional(),
        page: nested,
      }),
    );
    expect(extractSchemaProperties(schema)).toEqual(['items', 'page']);
    expect(inferFactoryResponseShape(schema)).toEqual({
      kind: 'object-property',
      listProperty: 'items',
      paginationProperty: 'page',
    });
  });

  it('writes deterministic output and rejects stale check-mode output', () => {
    const directory = mkdtempSync(join(tmpdir(), 'factory-cli-metadata-'));
    const outputPath = join(directory, 'generated.ts');
    try {
      generateFactoryApiCliRouteMetadata({ outputPath });
      expect(readFileSync(outputPath, 'utf8')).toBe(buildFactoryApiCliArtifact());
      expect(() => generateFactoryApiCliRouteMetadata({ outputPath, check: true })).not.toThrow();
      writeFileSync(outputPath, '// stale\n');
      expect(() => generateFactoryApiCliRouteMetadata({ outputPath, check: true })).toThrow(/stale/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
