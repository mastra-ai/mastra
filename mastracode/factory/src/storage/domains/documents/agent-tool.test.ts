import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import { createFactoryDocumentTools, MAX_TOOL_CONTENT_CHARS } from './agent-tool.js';

const scope = { orgId: 'org-1', factoryProjectId: 'project-1' };

async function seeded() {
  const seed = await createFactoryStorageForTests();
  await seed.documents.replaceSnapshot({
    ...scope,
    sourceRef: 'origin/main',
    sourceSha: 'sha-1',
    manifestStatus: 'ok',
    documents: [
      {
        kind: 'architecture',
        path: 'docs/factory/architecture.md',
        status: 'present',
        title: 'System Architecture',
        content: '# System Architecture\n\nTwo services.',
        sizeBytes: 40,
      },
      { kind: 'glossary', path: 'docs/factory/glossary.md', status: 'missing' },
      { kind: 'runbook', path: 'docs/factory/runbook.md', status: 'oversize', title: 'Runbook', sizeBytes: 999_999 },
    ],
  });
  const tools = createFactoryDocumentTools({ scope, documents: seed.documents });
  const tool = tools.factory_read_document!;
  const run = (input: Record<string, unknown>) =>
    (tool as { execute: (input: unknown) => Promise<unknown> }).execute(input);
  return { seed, tool, run };
}

describe('factory_read_document', () => {
  it('reads a present document by kind and by path', async () => {
    const { run } = await seeded();
    const byKind = (await run({ kind: 'architecture' })) as Record<string, unknown>;
    expect(byKind).toMatchObject({
      kind: 'architecture',
      path: 'docs/factory/architecture.md',
      title: 'System Architecture',
      sourceRef: 'origin/main',
      truncated: false,
    });
    expect(byKind.content).toContain('Two services.');
    expect(await run({ path: 'docs/factory/architecture.md' })).toEqual(byKind);
  });

  it('explains missing, oversize, and unknown documents', async () => {
    const { run } = await seeded();
    expect(await run({ kind: 'glossary' })).toMatchObject({
      error: 'document_missing',
      path: 'docs/factory/glossary.md',
    });
    expect(await run({ kind: 'runbook' })).toMatchObject({ error: 'document_oversize', sizeBytes: 999_999 });
    expect(await run({ kind: 'personas' })).toMatchObject({
      error: 'document_not_found',
      available: [
        { kind: 'architecture', path: 'docs/factory/architecture.md', title: 'System Architecture' },
        expect.anything(),
      ],
    });
    expect(await run({ path: 'docs/factory/nope.md' })).toMatchObject({ error: 'document_not_found' });
  });

  it('requires exactly one selector', async () => {
    const { tool } = await seeded();
    const schema = (tool as { inputSchema: { safeParse: (input: unknown) => { success: boolean } } }).inputSchema;
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ kind: 'glossary', path: 'docs/factory/glossary.md' }).success).toBe(false);
    expect(schema.safeParse({ kind: 'glossary' }).success).toBe(true);
    expect(schema.safeParse({ kind: 'not-a-kind' }).success).toBe(false);
  });

  it('truncates very large bodies', async () => {
    const { seed, run } = await seeded();
    await seed.documents.replaceSnapshot({
      ...scope,
      sourceRef: 'origin/main',
      sourceSha: 'sha-2',
      manifestStatus: 'ok',
      documents: [
        {
          kind: 'api-spec',
          path: 'docs/factory/api-spec.md',
          status: 'present',
          content: 'z'.repeat(MAX_TOOL_CONTENT_CHARS + 10),
        },
      ],
    });
    const result = (await run({ kind: 'api-spec' })) as { content: string; truncated: boolean; note?: string };
    expect(result.truncated).toBe(true);
    expect(result.content).toHaveLength(MAX_TOOL_CONTENT_CHARS);
    expect(result.note).toMatch(/cut at/);
  });
});
