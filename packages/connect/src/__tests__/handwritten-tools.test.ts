import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { planHandwrittenTools, writeProvider } from '../../scripts/generate-provider.js';
import type { GeneratedTool, ToolRegistration } from '../../scripts/generate-provider.js';
import { listInstalledProviderIds, providerDir, readManifest, readManifestIn } from '../../scripts/provider-utils.js';
import type { ProviderManifest } from '../../scripts/provider-utils.js';
import { PROVIDERS } from '../providers/index.js';

// Lets a test make the rename that publishes a regenerated provider fail.
const renameFault = vi.hoisted(() => ({ from: undefined as RegExp | undefined }));
vi.mock('node:fs', async importOriginal => {
  const fs = await importOriginal<typeof import('node:fs')>();
  return {
    ...fs,
    renameSync: (from: string, to: string) => {
      if (renameFault.from?.test(from)) {
        throw Object.assign(new Error(`EACCES: permission denied, rename '${from}'`), { code: 'EACCES' });
      }
      fs.renameSync(from, to);
    },
  };
});

const toCamel = (slug: string) => slug.replace(/-([a-z0-9])/g, (_, char: string) => char.toUpperCase());

function generatedTools(localId: string, manifest: ProviderManifest): ToolRegistration[] {
  return Object.keys(manifest.files).flatMap(file => {
    const slug = /^tools\/([^/]+)\.ts$/.exec(file)?.[1];
    return slug
      ? [{ slug, key: `${localId.replace(/-/g, '_')}_${slug.replace(/-/g, '_')}`, factoryName: `${toCamel(slug)}Tool` }]
      : [];
  });
}

// Regeneration rewrites tools.ts from the template actions plus the
// hand-written tools it finds. If it would lose a registered tool, the next
// template sync silently drops that tool from the toolset.
describe('regenerating a provider', () => {
  const generated = listInstalledProviderIds().flatMap(localId => {
    const manifest = readManifest(localId);
    return manifest ? [{ localId, manifest }] : [];
  });

  it.each(generated)('keeps every tool $localId registers today', ({ localId, manifest }) => {
    const tools = generatedTools(localId, manifest);
    const { handwrittenTools } = planHandwrittenTools(providerDir(localId), localId, tools);
    const registration = PROVIDERS.find(provider => provider.integrationId === localId);
    if (!registration || !('createTools' in registration)) throw new Error(`${localId} is not a registered toolset`);

    const planned = [...tools, ...handwrittenTools].map(tool => tool.key).sort();
    expect(planned).toEqual(Object.keys(registration.createTools()).sort());
  });

  it('keeps the Zendesk tools no template covers', () => {
    const { handwrittenFiles, handwrittenTools } = planHandwrittenTools(
      providerDir('zendesk'),
      'zendesk',
      generatedTools('zendesk', readManifest('zendesk')!),
    );

    expect(handwrittenFiles).toContain('article.ts');
    expect(handwrittenTools.map(tool => tool.key).sort()).toEqual([
      'zendesk_archive_article',
      'zendesk_create_article',
      'zendesk_delete_category',
      'zendesk_delete_organization',
      'zendesk_delete_section',
      'zendesk_delete_ticket',
      'zendesk_list_permission_groups',
      'zendesk_update_article',
      'zendesk_update_article_translation',
    ]);
  });
});

describe('regenerating a provider with hand-written files', () => {
  const pin = { repo: 'NangoHQ/integration-templates', sha: 'a'.repeat(40) };
  let root: string;
  let outputDir: string;

  afterEach(() => {
    renameFault.from = undefined;
    rmSync(root, { recursive: true, force: true });
  });

  const generatedTool = (slug: string): GeneratedTool => ({
    slug,
    key: `sample_${slug.replace(/-/g, '_')}`,
    factoryName: `${toCamel(slug)}Tool`,
    source: `export function ${toCamel(slug)}Tool(_proxy: unknown) {\n  return { id: 'sample_${slug.replace(/-/g, '_')}' };\n}\n`,
  });

  const generate = (tools: GeneratedTool[] = [generatedTool('list-items')]) =>
    writeProvider({
      outputDir,
      providerId: 'sample',
      localId: 'sample',
      templateSha: pin.sha,
      pin,
      tools,
      skippedActions: [],
    });

  const write = (file: string, contents: string) => {
    mkdirSync(resolve(outputDir, file, '..'), { recursive: true });
    writeFileSync(resolve(outputDir, file), contents);
  };

  function setUp() {
    root = mkdtempSync(resolve(tmpdir(), 'connect-handwritten-'));
    outputDir = resolve(root, 'sample');
  }

  it('keeps hand-written files and tools through repeated regeneration', async () => {
    setUp();
    await generate();
    const helper = 'export const SHARED = 1;\n';
    const tool =
      "import { SHARED } from './_shared.js';\n\nexport function archiveItemTool(_proxy: unknown) {\n  return { id: 'sample_archive_item', SHARED };\n}\n";
    write('tools/_shared.ts', helper);
    write('tools/archive-item.ts', tool);

    for (const _run of [1, 2]) {
      expect(await generate()).toEqual({ toolCount: 2 });
      expect(readFileSync(resolve(outputDir, 'tools/_shared.ts'), 'utf8')).toBe(helper);
      expect(readFileSync(resolve(outputDir, 'tools/archive-item.ts'), 'utf8')).toBe(tool);
      const manifest = readManifestIn(outputDir)!;
      expect(manifest.handwrittenFiles).toEqual(['tools/_shared.ts', 'tools/archive-item.ts']);
      expect(Object.keys(manifest.files).sort()).toEqual(['index.ts', 'tools.ts', 'tools/list-items.ts']);
      const registry = readFileSync(resolve(outputDir, 'tools.ts'), 'utf8');
      expect(registry).toContain('sample_archive_item: archiveItemTool(platformProxy)');
      expect(registry).toContain('sample_list_items: listItemsTool(platformProxy)');
      expect(registry).not.toContain('_shared');
    }
  });

  it('registers a hand-written tool that re-exports its factory', async () => {
    setUp();
    await generate();
    write('tools/_archive.ts', 'export function archiveItemTool(_proxy: unknown) {\n  return {};\n}\n');
    write('tools/archive-item.ts', "export { archiveItemTool } from './_archive.js';\n");

    expect(await generate()).toEqual({ toolCount: 2 });
  });

  it('refuses a hand-written tool whose factory is only mentioned, not exported', async () => {
    setUp();
    await generate();
    write('tools/archive-item.ts', '// export function archiveItemTool(proxy) {}\nexport const unrelated = 1;\n');

    await expect(generate()).rejects.toThrow(/must export archiveItemTool/);
    expect(readFileSync(resolve(outputDir, 'tools/archive-item.ts'), 'utf8')).toContain('unrelated');
  });

  it('refuses a hand-written tool whose key matches a generated one', async () => {
    setUp();
    await generate();
    write('tools/list_items.ts', 'export function list_itemsTool(_proxy: unknown) {\n  return {};\n}\n');

    await expect(generate()).rejects.toThrow(/collides with tool 'list-items'/);
    expect(readFileSync(resolve(outputDir, 'tools/list_items.ts'), 'utf8')).toContain('list_itemsTool');
  });

  it('refuses a hand-written tool that a later template action replaces', async () => {
    setUp();
    await generate();
    write('tools/archive-item.ts', 'export function archiveItemTool(_proxy: unknown) {\n  return {};\n}\n');

    await expect(generate([generatedTool('list-items'), generatedTool('archive-item')])).rejects.toThrow(
      /collides with tool 'archive-item'/,
    );
  });

  it('refuses to regenerate over files it has no readable manifest for', async () => {
    setUp();
    await generate();
    write('tools/archive-item.ts', 'export function archiveItemTool(_proxy: unknown) {\n  return {};\n}\n');
    writeFileSync(resolve(outputDir, '.manifest.json'), '{"truncated');

    await expect(generate()).rejects.toThrow(/no readable \.manifest\.json/);
    expect(readFileSync(resolve(outputDir, 'tools/archive-item.ts'), 'utf8')).toContain('archiveItemTool');
  });

  it('keeps hand-written files whose names are Object built-ins', async () => {
    setUp();
    await generate();
    write('constructor', 'kept\n');
    write('toString', 'kept\n');

    await generate();

    expect(readFileSync(resolve(outputDir, 'constructor'), 'utf8')).toBe('kept\n');
    expect(readFileSync(resolve(outputDir, 'toString'), 'utf8')).toBe('kept\n');
    expect(readManifestIn(outputDir)?.handwrittenFiles).toEqual(['constructor', 'toString']);
  });

  it('refuses to finish a first generation when files appeared in the provider while it ran', async () => {
    setUp();
    // writeProvider plans before its first await, so this lands after the plan.
    const run = generate();
    write('tools/archive-item.ts', 'export function archiveItemTool(_proxy: unknown) {\n  return {};\n}\n');

    await expect(run).rejects.toThrow(
      /gained hand-written files while it was being regenerated \(tools\/archive-item\.ts\)/,
    );
    expect(readFileSync(resolve(outputDir, 'tools/archive-item.ts'), 'utf8')).toContain('archiveItemTool');
  });

  it('keeps the installed provider and its hand-written files when publishing fails', async () => {
    setUp();
    await generate();
    const tool = 'export function archiveItemTool(_proxy: unknown) {\n  return {};\n}\n';
    write('tools/archive-item.ts', tool);
    write('notes.md', 'uncommitted\n');
    const before = readFileSync(resolve(outputDir, 'tools.ts'), 'utf8');
    renameFault.from = /\.sample\.generate-/;

    await expect(generate([generatedTool('list-items'), generatedTool('get-item')])).rejects.toThrow(/EACCES/);

    expect(readFileSync(resolve(outputDir, 'tools/archive-item.ts'), 'utf8')).toBe(tool);
    expect(readFileSync(resolve(outputDir, 'notes.md'), 'utf8')).toBe('uncommitted\n');
    expect(readFileSync(resolve(outputDir, 'tools.ts'), 'utf8')).toBe(before);
    expect(readdirSync(root)).toEqual(['sample']);
  });

  it('generates a provider that does not exist yet', async () => {
    setUp();

    expect(await generate()).toEqual({ toolCount: 1 });
    expect(readManifestIn(outputDir)?.handwrittenFiles).toBeUndefined();
  });
});
