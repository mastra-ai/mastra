import { createHmac } from 'node:crypto';
import { rm } from 'node:fs/promises';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { deterministicJsonModel } from '../fixtures/deterministic-language-model';
import { temporaryDatabasePath } from '../support/temp-path';

const savedEnvironment = { ...process.env };
const databases: string[] = [];
const runtimes: Array<{ shutdown(): Promise<void> }> = [];
const secret = 'phase005-lifecycle-secret';

function configure(databasePath: string) {
  process.env.DATABASE_URL = `file:${databasePath}`;
  process.env.LOCAL_DEMO_DATABASE_URL = `file:${databasePath}`;
  process.env.SUPPORT_SOURCE = 'intercom';
  process.env.INTERCOM_DEVELOPMENT_ENABLED = 'true';
  process.env.INTERCOM_TENANT_ID = 'local-demo';
  process.env.INTERCOM_APP_ID = 'phase005-app';
  process.env.INTERCOM_ACCESS_TOKEN = 'synthetic-token';
  process.env.INTERCOM_CLIENT_SECRET = secret;
  process.env.INTERCOM_ADMIN_ID = 'phase005-admin';
  process.env.INTERCOM_API_BASE_URL = 'http://intercom.test';
  process.env.INTERCOM_KNOWLEDGE_ENABLED = 'true';
  process.env.INTERCOM_TICKET_TYPE_ID = 'phase005-ticket';
  process.env.DISABLE_RUNTIME_SCORERS = '1';
}

function notification(
  id: string,
  topic: 'conversation.user.created' | 'conversation.user.replied',
  contactId: string,
  body: string,
  authorType: 'contact' | 'lead' = 'contact',
) {
  const now = Math.floor(Date.now() / 1_000);
  return JSON.stringify({
    type: 'notification_event',
    id,
    app_id: 'phase005-app',
    topic,
    created_at: now,
    data: {
      item: {
        id: 'conversation-phase005',
        title: 'Synthetic Intercom lifecycle',
        created_at: now - 1,
        source:
          topic === 'conversation.user.created'
            ? {
                id: `customer-source-${id}`,
                author: { type: authorType, id: contactId },
                body,
              }
            : {
                id: 'admin-started-source',
                author: { type: 'admin', id: 'phase005-admin' },
                body: 'Initial admin message is not the reply.',
              },
        conversation_parts:
          topic === 'conversation.user.replied'
            ? {
                conversation_parts: [
                  {
                    id: 'admin-part',
                    author: { type: 'admin', id: 'phase005-admin' },
                    body: 'Please provide more detail.',
                    created_at: now - 1,
                  },
                  {
                    id: `customer-part-${id}`,
                    author: { type: authorType, id: contactId },
                    body,
                    created_at: now,
                  },
                ],
              }
            : undefined,
      },
    },
  });
}

function signedHeaders(body: string) {
  return {
    'content-type': 'application/json',
    'x-hub-signature': `sha1=${createHmac('sha1', secret).update(body).digest('hex')}`,
  };
}

async function runtime() {
  const databasePath = temporaryDatabasePath('phase005-lifecycle');
  databases.push(databasePath, `${databasePath}-wal`, `${databasePath}-shm`);
  configure(databasePath);
  const requests: Request[] = [];
  let articleRevision = 0;
  let articlesAreEmpty = false;
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init);
    requests.push(request);
    const path = new URL(request.url).pathname;
    if (path.startsWith('/contacts/')) {
      const id = path.split('/').at(-1)!;
      return Response.json({
        id,
        email: `${id}@example.test`,
        name: `Contact ${id}`,
      });
    }
    if (path === '/articles' && new URL(request.url).searchParams.get('starting_after') === 'published-first')
      return Response.json({
        data: [
          {
            id: 'published-second',
            state: 'published',
            title: 'Published second',
            body: 'Second synthetic escalation policy.',
            updated_at: 1_700_000_002 + articleRevision,
          },
        ],
        pages: { page: 2, per_page: 50, total_pages: 2, next: null },
      });
    if (path === '/articles' && articlesAreEmpty)
      return Response.json({
        type: 'list',
        total_count: 0,
        data: [],
        pages: { type: 'pages', page: 1, per_page: 50, total_pages: 0 },
      });
    if (path === '/articles')
      return Response.json({
        data: [
          {
            id: 'published-first',
            state: 'published',
            title: 'Published first',
            body: 'Synthetic escalation policy.',
            updated_at: 1_700_000_000 + articleRevision,
          },
          {
            id: 'draft-only',
            state: 'draft',
            title: 'Must not publish',
            body: 'private',
            updated_at: 1_700_000_001 + articleRevision,
          },
        ],
        pages: {
          page: 1,
          per_page: 50,
          total_pages: 2,
          next: { starting_after: 'published-first', per_page: 50 },
        },
      });
    if (path.startsWith('/articles/')) {
      const id = path.split('/').at(-1)!;
      return Response.json({
        id,
        state: 'published',
        title: `Published ${id}`,
        body: `Synthetic ${id} policy.`,
        updated_at: (id === 'published-second' ? 1_700_000_002 : 1_700_000_000) + articleRevision,
      });
    }
    if (path.endsWith('/convert')) return Response.json({ type: 'ticket', id: 'intercom-ticket' });
    if (path.startsWith('/conversations/')) {
      if (request.method === 'GET')
        return Response.json({
          type: 'conversation',
          id: 'conversation-phase005',
          state: 'closed',
          conversation_parts: {
            type: 'conversation_part.list',
            conversation_parts: [],
            total_count: 0,
          },
        });
      const payload = (await request.json()) as {
        body?: string;
        message_type?: string;
      };
      return Response.json({
        type: 'conversation',
        id: 'conversation-phase005',
        ...(payload.message_type === 'close'
          ? { state: 'closed' }
          : payload.message_type === 'open'
            ? { state: 'open' }
            : {}),
        conversation_parts: {
          type: 'conversation_part.list',
          conversation_parts: [
            {
              type: 'conversation',
              id: `intercom-part-${requests.length}`,
              part_type: payload.message_type,
              author: { type: 'admin', id: 'phase005-admin' },
              body: payload.body ?? '',
            },
          ],
          total_count: 1,
        },
      });
    }
    throw new Error(`Unexpected Intercom mock request: ${path}`);
  });
  vi.resetModules();
  vi.doMock('@mastra/core/llm', async importOriginal => {
    const actual = await importOriginal<typeof import('@mastra/core/llm')>();
    return {
      ...actual,
      ModelRouterEmbeddingModel: class DeterministicEmbeddingModel {
        async doEmbed({ values }: { values: string[] }) {
          return { embeddings: values.map(() => Array(1536).fill(0)) };
        }
      },
    };
  });
  const { mastra } = await import('../../src/mastra/index');
  const { caseStore } = await import('../../src/mastra/lib/case-store');
  const { intercomWebhookRoute } = await import('../../src/mastra/server/routes');
  const { knowledgePublicationStore } = await import('../../src/mastra/lib/knowledge-publications');
  const { publishKnowledge } = await import('../../src/mastra/lib/publish-knowledge');
  const { recoverLocalWorkflows } = await import('../../src/mastra/runtime/local-runtime');
  const { triageAgent } = await import('../../src/mastra/agents/triage-agent');
  const { responseAgent } = await import('../../src/mastra/agents/response-agent');
  triageAgent.__updateModel({
    model: deterministicJsonModel({
      intent: 'other',
      urgency: 'normal',
      sentiment: 'neutral',
      requiresHumanReview: false,
      confidence: 1,
      rationale: 'Deterministic lifecycle test.',
    }),
  });
  responseAgent.__updateModel({
    model: deterministicJsonModel({
      draftResponse: 'A deterministic escalation response.',
      citedSources: [],
      recommendRefund: false,
      requiresEscalation: true,
      escalationReason: 'Synthetic escalation.',
    }),
  });
  runtimes.push(mastra);
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('mastra', mastra as never);
    await next();
  });
  app.post('/support/webhooks/intercom', intercomWebhookRoute.handler);
  return {
    app,
    caseStore,
    requests,
    recoverLocalWorkflows,
    knowledgePublicationStore,
    publishKnowledge,
    advanceArticleRevision: () => {
      articleRevision += 1;
    },
    serveEmptyArticles: () => {
      articlesAreEmpty = true;
    },
  };
}

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map(value => value.shutdown()));
  await Promise.all(databases.splice(0).map(file => rm(file, { force: true })));
  process.env = { ...savedEnvironment };
  vi.doUnmock('@mastra/core/llm');
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Phase 005 Intercom registered lifecycle', () => {
  it('drives signed create/follow-up/replay through the registered HTTP and ingest workflows, preserving owner and ordered external effects', async () => {
    const {
      app,
      caseStore,
      requests,
      recoverLocalWorkflows,
      knowledgePublicationStore,
      publishKnowledge,
      advanceArticleRevision,
      serveEmptyArticles,
    } = await runtime();
    const created = notification(
      'event-created',
      'conversation.user.created',
      'lead-a',
      'First customer message.',
      'lead',
    );
    const first = await app.request('http://support.test/support/webhooks/intercom', {
      method: 'POST',
      headers: signedHeaders(created),
      body: created,
    });
    expect(first.status).toBe(200);
    const { caseId } = (await first.json()) as { caseId: string };

    await recoverLocalWorkflows((await import('../../src/mastra/index')).mastra, 10, caseStore);
    await vi.waitFor(async () =>
      expect(await caseStore.get(caseId)).toMatchObject({
        status: 'escalated',
      }),
    );
    const [initialTurn] = await caseStore.turns(caseId);
    expect(initialTurn).toBeDefined();
    const followUp = notification(
      'event-follow-up',
      'conversation.user.replied',
      'lead-a',
      'Actual signed follow-up.',
      'lead',
    );
    const second = await app.request('http://support.test/support/webhooks/intercom', {
      method: 'POST',
      headers: signedHeaders(followUp),
      body: followUp,
    });
    expect(second.status).toBe(200);
    await vi.waitFor(async () => expect(await caseStore.turns(caseId)).toHaveLength(2));
    const replay = await app.request('http://support.test/support/webhooks/intercom', {
      method: 'POST',
      headers: signedHeaders(followUp),
      body: followUp,
    });
    expect(replay.status).toBe(200);
    expect(await recoverLocalWorkflows((await import('../../src/mastra/index')).mastra, 10, caseStore)).toBe(0);

    const attacker = notification(
      'event-owner-mismatch',
      'conversation.user.replied',
      'contact-b',
      'Cannot take over this case.',
    );
    expect(
      (
        await app.request('http://support.test/support/webhooks/intercom', {
          method: 'POST',
          headers: signedHeaders(attacker),
          body: attacker,
        })
      ).status,
    ).toBe(503);
    const supportCase = await caseStore.get(caseId);
    if (!supportCase) throw new Error('Expected persisted Intercom case.');
    expect((supportCase.metadata as { ownerId?: string }).ownerId).toBe('intercom:local-demo:contact:lead-a');
    expect(await caseStore.turns(caseId)).toHaveLength(2);

    const outbox = await caseStore.getClient().execute({
      sql: 'SELECT operation, state FROM support_outbox WHERE id LIKE ? ORDER BY created_at, id',
      args: [`outbox_${caseId}_${initialTurn!.id}_%`],
    });
    expect(outbox.rows.map(row => row.operation)).toEqual(['reply', 'note', 'status', 'ticket']);
    expect(outbox.rows.every(row => row.state === 'delivered')).toBe(true);
    const articlePageRequests = requests
      .map(request => new URL(request.url))
      .filter(url => url.pathname === '/articles');
    expect(
      articlePageRequests.some(
        url =>
          url.searchParams.get('starting_after') === 'published-first' &&
          url.searchParams.get('per_page') === '50' &&
          !url.searchParams.has('page'),
      ),
    ).toBe(true);
    const publication = await knowledgePublicationStore.publication({
      tenantId: 'local-demo',
      providerKind: 'intercom',
      providerAccountId: 'phase005-app',
      externalConversationId: 'conversation-phase005',
    });
    expect(publication.generationId).toBeDefined();
    const knowledgeBinding = {
      tenantId: 'local-demo',
      providerKind: 'intercom' as const,
      providerAccountId: 'phase005-app',
      externalConversationId: 'conversation-phase005',
    };
    const documents = await caseStore.getClient().execute({
      sql: 'SELECT d.source, d.version, g.tenant_id, g.provider_kind, g.provider_account_id FROM support_knowledge_documents d JOIN support_knowledge_generations g ON g.id = d.generation_id WHERE d.generation_id = ? ORDER BY d.source',
      args: [publication.generationId!],
    });
    expect(documents.rows).toEqual([
      expect.objectContaining({
        source: 'intercom:article:published-first',
        version: '1700000000',
        tenant_id: 'local-demo',
        provider_kind: 'intercom',
        provider_account_id: 'phase005-app',
      }),
      expect.objectContaining({
        source: 'intercom:article:published-second',
        version: '1700000002',
        tenant_id: 'local-demo',
        provider_kind: 'intercom',
        provider_account_id: 'phase005-app',
      }),
    ]);
    advanceArticleRevision();
    const replacement = await publishKnowledge(knowledgeBinding);
    expect(replacement.generationId).not.toBe(publication.generationId);
    await knowledgePublicationStore.rollback(knowledgeBinding, publication.generationId!);
    expect(await knowledgePublicationStore.activeGeneration(knowledgeBinding)).toBe(publication.generationId);
    serveEmptyArticles();
    await expect(publishKnowledge(knowledgeBinding)).rejects.toThrow('Knowledge candidate has no documents.');
    expect(await knowledgePublicationStore.activeGeneration(knowledgeBinding)).toBe(publication.generationId);
  });
});
