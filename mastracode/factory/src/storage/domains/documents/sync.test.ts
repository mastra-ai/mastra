import { describe, expect, it } from 'vitest';

import type { ExecutableSandbox } from '../../../sandbox/materialization.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { FACTORY_DOC_KINDS } from './catalog.js';
import { digestDocumentBody, MAX_DOC_BYTES, syncFactoryDocuments } from './sync.js';

const scope = { orgId: 'org-1', factoryProjectId: 'project-1' };
const WORKDIR = '/work/repo';

/**
 * A sandbox whose git is a map of `<ref>:<path>` → file body. `rev-parse`
 * answers from `shas`; unknown refs exit 128 like real git.
 */
function fakeSandbox(options: { files: Record<string, string>; shas: Record<string, string> }) {
  const commands: string[] = [];
  const sandbox: ExecutableSandbox = {
    id: 'fake',
    async executeCommand(_command, args) {
      const script = args?.[1] ?? '';
      commands.push(script);
      const revParse = /git -C '([^']+)' rev-parse --verify '([^']+)\^\{commit\}'/.exec(script);
      if (revParse) {
        const sha = options.shas[revParse[2]!];
        return sha
          ? { exitCode: 0, stdout: `${sha}\n`, stderr: '' }
          : { exitCode: 128, stdout: '', stderr: `fatal: Needed a single revision` };
      }
      const show = /git -C '([^']+)' show '([^']+)'/.exec(script);
      if (show) {
        expect(show[1]).toBe(WORKDIR);
        const body = options.files[show[2]!];
        return body === undefined
          ? { exitCode: 128, stdout: '', stderr: `fatal: path does not exist in '${show[2]}'` }
          : { exitCode: 0, stdout: body, stderr: '' };
      }
      throw new Error(`unexpected command: ${script}`);
    },
  };
  return { sandbox, commands };
}

describe('digestDocumentBody', () => {
  it('extracts the first heading and first prose paragraph, skipping frontmatter and fences', () => {
    const digest = digestDocumentBody(
      '---\nowner: platform\n---\n\n```ts\nconst x = 1;\n```\n\n# System Architecture #\n\n## Overview\n\n- bullet\n\nThree services sit\nbehind one gateway.\n\nMore text.',
    );
    expect(digest.title).toBe('System Architecture');
    expect(digest.summary).toBe('Three services sit behind one gateway.');
    expect(digest.sizeBytes).toBeGreaterThan(0);
    expect(digest.contentHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('caps the summary and tolerates bodies without headings', () => {
    const digest = digestDocumentBody('x'.repeat(1000));
    expect(digest.title).toBeNull();
    expect([...digest.summary!]).toHaveLength(240);
    expect(digest.summary!.endsWith('…')).toBe(true);
  });
});

describe('syncFactoryDocuments', () => {
  it('reads the manifest and every catalog kind from the given ref only', async () => {
    const seed = await createFactoryStorageForTests();
    const { sandbox, commands } = fakeSandbox({
      shas: { 'origin/main': 'sha-main' },
      files: {
        'origin/main:docs/factory/manifest.yaml': 'documents:\n  architecture: docs/factory/arch/system.md\n',
        'origin/main:docs/factory/arch/system.md': '# System\n\nOne box.',
        'origin/main:docs/factory/glossary.md': '# Glossary\n\nWords.',
        // Present on the working branch only — must never be read.
        'HEAD:docs/factory/personas.md': '# Personas',
      },
    });

    const result = await syncFactoryDocuments({
      ...scope,
      sandbox,
      workdir: WORKDIR,
      ref: 'origin/main',
      storage: seed.documents,
    });

    expect(result).toEqual({ outcome: 'synced', sourceSha: 'sha-main', manifestStatus: 'ok', warnings: [] });
    expect(commands.every(command => command.includes("'origin/main") || command.includes('rev-parse'))).toBe(true);
    expect(commands.some(command => command.includes('HEAD'))).toBe(false);

    const rows = await seed.documents.list(scope);
    expect(rows).toHaveLength(FACTORY_DOC_KINDS.length);
    expect(rows.find(row => row.kind === 'architecture')).toMatchObject({
      status: 'present',
      path: 'docs/factory/arch/system.md',
      title: 'System',
      summary: 'One box.',
      sourceRef: 'origin/main',
      sourceSha: 'sha-main',
    });
    expect(rows.find(row => row.kind === 'personas')).toMatchObject({ status: 'missing' });
  });

  it('falls back to default paths and records a missing manifest', async () => {
    const seed = await createFactoryStorageForTests();
    const { sandbox } = fakeSandbox({
      shas: { 'origin/main': 'sha-1' },
      files: { 'origin/main:docs/factory/glossary.md': 'terms' },
    });
    const result = await syncFactoryDocuments({
      ...scope,
      sandbox,
      workdir: WORKDIR,
      ref: 'origin/main',
      storage: seed.documents,
    });
    expect(result).toMatchObject({ outcome: 'synced', manifestStatus: 'missing' });
    expect((await seed.documents.getByKind(scope, 'glossary'))?.content).toBe('terms');
  });

  it('indexes oversize bodies without storing them', async () => {
    const seed = await createFactoryStorageForTests();
    const { sandbox } = fakeSandbox({
      shas: { 'origin/main': 'sha-1' },
      files: { 'origin/main:docs/factory/runbook.md': `# Runbook\n\n${'y'.repeat(MAX_DOC_BYTES)}` },
    });
    const result = await syncFactoryDocuments({
      ...scope,
      sandbox,
      workdir: WORKDIR,
      ref: 'origin/main',
      storage: seed.documents,
    });
    expect(result).toMatchObject({ outcome: 'synced', warnings: [expect.stringMatching(/runbook\.md is \d+ bytes/)] });
    const runbook = await seed.documents.getByKind(scope, 'runbook');
    expect(runbook).toMatchObject({ status: 'oversize', title: 'Runbook', content: null });
    expect(runbook?.sizeBytes).toBeGreaterThan(MAX_DOC_BYTES);
  });

  it('short-circuits when the stored snapshot already matches the commit', async () => {
    const seed = await createFactoryStorageForTests();
    const { sandbox, commands } = fakeSandbox({ shas: { 'origin/main': 'sha-1' }, files: {} });
    await syncFactoryDocuments({ ...scope, sandbox, workdir: WORKDIR, ref: 'origin/main', storage: seed.documents });
    const before = commands.length;

    const result = await syncFactoryDocuments({
      ...scope,
      sandbox,
      workdir: WORKDIR,
      ref: 'origin/main',
      storage: seed.documents,
    });

    expect(result).toEqual({ outcome: 'unchanged', sourceSha: 'sha-1' });
    expect(commands.length - before).toBe(1);
  });

  it('reports an unavailable ref instead of throwing', async () => {
    const seed = await createFactoryStorageForTests();
    const { sandbox } = fakeSandbox({ shas: {}, files: {} });
    const result = await syncFactoryDocuments({
      ...scope,
      sandbox,
      workdir: WORKDIR,
      ref: 'origin/main',
      storage: seed.documents,
    });
    expect(result).toMatchObject({ outcome: 'ref-unavailable' });
    expect(await seed.documents.list(scope)).toEqual([]);
  });
});
