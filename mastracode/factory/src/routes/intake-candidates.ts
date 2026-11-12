/**
 * The Intake column's list: the open provider records of a project that have no
 * card. The server's own passes and provider events keep it, so reading it calls
 * no provider and writes nothing, however many boards are open.
 */

import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import type { z } from 'zod';

import { readIntakePassReports } from '../integrations/intake-pass.js';
import type { IntegrationStorage } from '../storage/domains/integrations/base.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import { loose } from './route.js';
import type { RouteAuth } from './route.js';

const contract = FACTORY_ROUTE_CONTRACTS.intakeCandidateList;

type Position = NonNullable<Awaited<ReturnType<WorkItemsStorage['listIntakeCandidates']>>['next']>;

export interface IntakeCandidateRouteDependencies {
  auth: RouteAuth;
  projects: FactoryProjectsStorage;
  workItems: Pick<WorkItemsStorage, 'listIntakeCandidates'>;
  settings: Pick<IntegrationStorage, 'listSettings'>;
}

function encodeCursor(position: Position): string {
  return Buffer.from(JSON.stringify([position.createdAt.toISOString(), position.id])).toString('base64url');
}

function decodeCursor(cursor: string): Position | null {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;
    if (!Array.isArray(parsed) || typeof parsed[0] !== 'string' || typeof parsed[1] !== 'string') return null;
    const createdAt = new Date(parsed[0]);
    return Number.isNaN(createdAt.getTime()) ? null : { createdAt, id: parsed[1] };
  } catch {
    return null;
  }
}

export function buildIntakeCandidateRoutes(deps: IntakeCandidateRouteDependencies): ApiRoute[] {
  const { auth, projects, workItems, settings } = deps;
  return [
    registerApiRoute(contract.path, {
      method: contract.method,
      requiresAuth: false,
      handler: async cc => {
        const c = loose(cc);
        await auth.ensureUser(c);
        const tenant = auth.tenant(c);
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);
        if (!tenant.orgId) {
          return c.json({ error: 'organization_required', message: 'Intake belongs to an organization.' }, 403);
        }
        const path = contract.pathSchema.safeParse({ id: c.req.param('id') });
        if (!path.success) return c.json({ error: 'Project not found' }, 404);
        const query = contract.querySchema.safeParse({
          kind: c.req.query('kind'),
          source: c.req.query('source'),
          cursor: c.req.query('cursor'),
          limit: c.req.query('limit'),
        });
        if (!query.success) return c.json({ error: 'invalid_request' }, 400);
        const after = query.data.cursor ? decodeCursor(query.data.cursor) : undefined;
        if (after === null) return c.json({ error: 'invalid_cursor' }, 400);

        await projects.ensureReady();
        const scope = { orgId: tenant.orgId, factoryProjectId: path.data.id };
        if (!(await projects.get({ orgId: scope.orgId, id: scope.factoryProjectId }))) {
          return c.json({ error: 'Project not found' }, 404);
        }

        const [page, passes] = await Promise.all([
          workItems.listIntakeCandidates({
            ...scope,
            ...(query.data.kind ? { kind: query.data.kind } : {}),
            ...(query.data.source ? { integrationId: query.data.source } : {}),
            ...(after ? { after } : {}),
            limit: query.data.limit,
          }),
          readIntakePassReports(settings, scope),
        ]);

        return c.json({
          candidates: page.candidates.map(candidate => ({
            workItemId: candidate.workItemId,
            title: candidate.title,
            externalSource: {
              integrationId: candidate.externalSource.integrationId,
              type: candidate.externalSource.type,
              externalId: candidate.externalSource.externalId,
              ...(candidate.externalSource.url ? { url: candidate.externalSource.url } : {}),
            },
            key: candidate.source.key ?? null,
            url: candidate.source.url ?? null,
            state: candidate.source.state ?? null,
            labels: candidate.source.labels ?? [],
            author: candidate.source.author ?? null,
            metadata: candidate.source.metadata ?? {},
            createdAt: candidate.createdAt.toISOString(),
          })),
          ...(page.next ? { nextCursor: encodeCursor(page.next) } : {}),
          passes,
        } satisfies z.input<typeof contract.responseSchema>);
      },
    }),
  ];
}
