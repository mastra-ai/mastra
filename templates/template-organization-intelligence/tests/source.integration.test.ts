import { execFile } from 'node:child_process';
import { access, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { LocalFilesystem } from '@mastra/core/workspace';
import { GoogleDriveFilesystem } from '@mastra/google-drive';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSourceInspectionWorkflow } from '../src/mastra/workflows/source-inspection.js';
import type { SourceCatalog } from '../src/mastra/workspaces/catalog.js';
import { loadCatalog, validateEnvironment } from '../src/mastra/workspaces/catalog.js';
import { createSourceRuntime } from '../src/mastra/workspaces/sources.js';

const testEnvironment = {
  OPENAI_API_KEY: 'test-openai-key',
  GOOGLE_DRIVE_CLIENT_EMAIL: 'source-test@example.test',
  GOOGLE_DRIVE_PRIVATE_KEY: 'test-private-key',
};
const runCommand = promisify(execFile);
const checkEnvironmentScript = fileURLToPath(new URL('../scripts/check-env.mjs', import.meta.url));

describe('source integration', () => {
  let directory: string;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'organization-sources-'));
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    await rm(directory, { recursive: true, force: true });
  });

  function catalog(overrides: Partial<SourceCatalog> = {}): SourceCatalog {
    return {
      version: 1,
      sources: [
        { id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true },
        {
          id: 'policies',
          provider: 'google-drive',
          mountPath: '/drive/policies',
          folderId: 'folder-policies',
          credentialRef: 'organization',
          enabled: true,
        },
        {
          id: 'processes',
          provider: 'google-drive',
          mountPath: '/drive/processes',
          folderId: 'folder-processes',
          credentialRef: 'organization',
          enabled: true,
        },
      ],
      ...overrides,
    };
  }

  function localDriveFactory(roots: Record<string, string>) {
    return (options: { folderId: string; readOnly?: boolean }) => {
      return new LocalFilesystem({
        basePath: roots[options.folderId] ?? directory,
        contained: true,
        readOnly: options.readOnly,
      });
    };
  }

  function installGoogleDriveResponses(denied = false) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) => {
        if (denied) return new Response('private-token=should-not-escape', { status: 403 });
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        const folderId = url.pathname.split('/').at(-1);
        const fileIdByFolder: Record<string, string> = {
          'folder-policies': 'policy-guide',
          'folder-processes': 'process-guide',
        };
        const contentByFile: Record<string, string> = {
          'policy-guide': 'Policy: retain invoices for seven years.',
          'process-guide': 'Process: records staff approve archival access.',
        };
        if (url.pathname.startsWith('/drive/v3/files/folder-')) {
          return Response.json({ id: folderId, name: folderId, mimeType: 'application/vnd.google-apps.folder' });
        }
        if (url.pathname === '/drive/v3/files') {
          const folder = Object.keys(fileIdByFolder).find(id => url.searchParams.get('q')?.includes(`'${id}'`));
          const fileId = folder ? fileIdByFolder[folder] : undefined;
          return Response.json({
            files: fileId ? [{ id: fileId, name: 'guide.md', mimeType: 'text/markdown', size: '48' }] : [],
          });
        }
        const fileId = url.pathname.split('/').at(-1) ?? '';
        if (url.searchParams.get('alt') === 'media' && contentByFile[fileId])
          return new Response(contentByFile[fileId]);
        return new Response('not found', { status: 404 });
      }),
    );
  }

  function googleDriveFactory(capturedOptions: Array<{ readOnly?: boolean; getAccessToken?: unknown }>) {
    return (options: { folderId: string; readOnly?: boolean; getAccessToken?: unknown }) => {
      capturedOptions.push({ readOnly: options.readOnly, getAccessToken: options.getAccessToken });
      return new GoogleDriveFilesystem({
        folderId: options.folderId,
        readOnly: options.readOnly,
        getAccessToken: () => 'synthetic-drive-access-token',
      });
    };
  }

  async function prepareSources() {
    const sample = join(directory, 'sample');
    const policies = join(directory, 'policies');
    const processes = join(directory, 'processes');
    await Promise.all([mkdir(sample), mkdir(policies), mkdir(processes)]);
    await Promise.all([
      writeFile(join(sample, 'overview.md'), 'Sample: the records office owns retention guidance.'),
      writeFile(join(sample, 'guide.md'), 'Sample: contact the records office.'),
      writeFile(join(policies, 'guide.md'), 'Policy: retain invoices for seven years.'),
      writeFile(join(processes, 'guide.md'), 'Process: records staff approve archival access.'),
    ]);
    return { sample, policies, processes };
  }

  it('mounts preserve source identity', async () => {
    await prepareSources();
    installGoogleDriveResponses();
    const driveOptions: Array<{ readOnly?: boolean; getAccessToken?: unknown }> = [];
    const runtime = await createSourceRuntime({
      catalog: catalog(),
      catalogPath: join(directory, 'source-catalog.json'),
      ledgerPath: join(directory, 'state', 'ledger.json'),
      environment: testEnvironment,
      driveFilesystemFactory: googleDriveFactory(driveOptions),
    });

    await expect(runtime.inspect('sample', 'overview.md')).resolves.toMatchObject({
      sourceId: 'sample',
      mountPath: '/sample',
      content: expect.stringContaining('records office'),
    });
    await expect(runtime.inspect('policies', 'guide.md')).resolves.toMatchObject({
      sourceId: 'policies',
      mountPath: '/drive/policies',
      content: expect.stringContaining('seven years'),
    });
    await expect(runtime.inspect('processes', 'guide.md')).resolves.toMatchObject({
      sourceId: 'processes',
      mountPath: '/drive/processes',
      content: expect.stringContaining('records staff'),
    });
    expect((await runtime.inspect('sample', 'guide.md')).content).toBe('Sample: contact the records office.');
    await expect(runtime.workspace.filesystem!.writeFile('/drive/policies/guide.md', 'replacement')).rejects.toThrow();
    expect((await runtime.inspect('policies', 'guide.md')).content).toContain('seven years');
    expect(driveOptions).toEqual([
      expect.objectContaining({ readOnly: true, getAccessToken: expect.any(Function) }),
      expect.objectContaining({ readOnly: true, getAccessToken: expect.any(Function) }),
    ]);
  });

  it('reject invalid mount configuration', async () => {
    const roots = await prepareSources();
    const ledgerPath = join(directory, 'state', 'ledger.json');
    const invalid = catalog({
      sources: [
        { id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true },
        { id: 'duplicate', provider: 'local', mountPath: '/sample/child', root: './policies', enabled: true },
      ],
    });

    await expect(
      createSourceRuntime({
        catalog: invalid,
        catalogPath: join(directory, 'source-catalog.json'),
        ledgerPath,
        environment: testEnvironment,
      }),
    ).rejects.toThrow('overlap');
    await expect(access(ledgerPath)).rejects.toMatchObject({ code: 'ENOENT' });

    await expect(
      createSourceRuntime({
        catalog: catalog({
          sources: [
            { id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true },
            { id: 'broken', provider: 'local', mountPath: '/other', root: './missing', enabled: true },
          ],
        }),
        catalogPath: join(directory, 'source-catalog.json'),
        ledgerPath,
        environment: testEnvironment,
      }),
    ).rejects.toThrow('inaccessible');
    const invalidCatalogs = [
      catalog({ sources: [catalog().sources[0]!, catalog().sources[0]!] }),
      catalog({
        sources: catalog().sources.map(source =>
          source.id === 'processes' ? { ...source, mountPath: '/drive/policies/' } : source,
        ),
      }),
      catalog({
        sources: catalog().sources.map(source =>
          source.id === 'processes' ? { ...source, folderId: 'folder-policies' } : source,
        ),
      }),
      catalog({
        sources: [
          catalog().sources[0]!,
          { id: 'alias', provider: 'local', mountPath: '/alias', root: roots.sample, enabled: true },
        ],
      }),
    ];
    for (const invalidCatalog of invalidCatalogs) {
      await expect(
        createSourceRuntime({
          catalog: invalidCatalog,
          catalogPath: join(directory, 'source-catalog.json'),
          ledgerPath,
          environment: testEnvironment,
        }),
      ).rejects.toThrow();
      await expect(access(ledgerPath)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    for (const environment of [{ OPENAI_API_KEY: 'test' }, { ...testEnvironment, GOOGLE_DRIVE_PRIVATE_KEY: '' }]) {
      await expect(
        createSourceRuntime({
          catalog: catalog(),
          catalogPath: join(directory, 'source-catalog.json'),
          ledgerPath,
          environment,
        }),
      ).rejects.toThrow('credential');
      await expect(access(ledgerPath)).rejects.toMatchObject({ code: 'ENOENT' });
    }
    const filePath = join(directory, 'source-catalog.json');
    await writeFile(
      filePath,
      JSON.stringify({ ...catalog(), sources: [{ ...catalog().sources[1], credentialRef: 'unknown' }] }),
    );
    await expect(loadCatalog(filePath)).rejects.toThrow('invalid source');
    await writeFile(filePath, JSON.stringify(catalog()));
    const recovered = await loadCatalog(filePath);
    expect(validateEnvironment(recovered, {})).toEqual(
      expect.arrayContaining([expect.stringContaining('OPENAI_API_KEY'), expect.stringContaining('Drive')]),
    );
    expect(validateEnvironment(recovered, testEnvironment)).toEqual([]);
    const runtime = await createSourceRuntime({
      catalog: recovered,
      catalogPath: filePath,
      ledgerPath,
      environment: testEnvironment,
      driveFilesystemFactory: localDriveFactory({
        'folder-policies': roots.policies,
        'folder-processes': roots.processes,
      }),
    });
    expect((await runtime.inspect('sample', 'overview.md')).status).toBe('available');
  });

  it('reject paths outside configured mounts', async () => {
    const roots = await prepareSources();
    const outside = join(directory, 'secret.txt');
    await writeFile(outside, 'do-not-disclose');
    await symlink(outside, join(roots.sample, 'outside-link'));
    const runtime = await createSourceRuntime({
      catalog: catalog({
        sources: [{ id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true }],
      }),
      catalogPath: join(directory, 'source-catalog.json'),
      ledgerPath: join(directory, 'state', 'ledger.json'),
      environment: testEnvironment,
    });

    await expect(runtime.inspect('sample', '../secret.txt')).rejects.toThrow('contained');
    await expect(runtime.inspect('sample', 'outside-link')).resolves.toEqual({
      sourceId: 'sample',
      mountPath: '/sample',
      status: 'unavailable',
      error: 'Source sample is unavailable. Confirm its configured local root.',
    });
    await expect(runtime.workspace.filesystem!.writeFile('/sample/overview.md', 'replacement')).rejects.toThrow();
    expect(await readFile(join(roots.sample, 'overview.md'), 'utf8')).toContain('records office');
    expect((await lstat(join(roots.sample, 'outside-link'))).isSymbolicLink()).toBe(true);
  });

  it('check env rejects unusable local state locations without writing', async () => {
    const roots = await prepareSources();
    await writeFile(
      join(directory, 'source-catalog.json'),
      JSON.stringify({
        version: 1,
        sources: [{ id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true }],
      }),
    );

    for (const stateSetup of [
      async () => writeFile(join(directory, '.mastra'), 'not-a-directory'),
      async () => {
        await mkdir(join(directory, '.mastra'));
        await mkdir(join(directory, '.mastra', 'organization-intelligence.db'));
      },
    ]) {
      await stateSetup();
      let failure: { stderr?: string } | undefined;
      try {
        await runCommand(process.execPath, ['--env-file-if-exists=.env', checkEnvironmentScript], {
          cwd: directory,
          env: { ...process.env, ...testEnvironment },
        });
      } catch (error) {
        failure = error as { stderr?: string };
      }
      expect(failure?.stderr).toContain('local state');
      await rm(join(directory, '.mastra'), { recursive: true, force: true });
    }
    expect(await readFile(join(roots.sample, 'overview.md'), 'utf8')).toContain('records office');
  });

  it('file catalog supports multiple Drive folders', async () => {
    const roots = await prepareSources();
    const ledgerPath = join(directory, 'state', 'ledger.json');
    const factory = localDriveFactory({ 'folder-policies': roots.policies, 'folder-processes': roots.processes });
    const catalogPath = join(directory, 'source-catalog.json');
    const initialCatalog = catalog();
    await writeFile(catalogPath, JSON.stringify(initialCatalog));
    const startupCatalog = await loadCatalog(catalogPath);
    const first = await createSourceRuntime({
      catalog: startupCatalog,
      catalogPath,
      ledgerPath,
      environment: testEnvironment,
      driveFilesystemFactory: factory,
    });
    const mutablePolicy = startupCatalog.sources.find(source => source.id === 'policies');
    if (!mutablePolicy || mutablePolicy.provider !== 'google-drive') throw new Error('Expected policies source.');
    mutablePolicy.folderId = 'mutated-after-startup';
    expect((await first.inspect('policies', 'guide.md')).content).toContain('seven years');

    const archive = join(directory, 'archive');
    await mkdir(archive);
    await writeFile(join(archive, 'guide.md'), 'Archive: preserve board minutes permanently.');
    const revisedCatalog = catalog({
      sources: [
        initialCatalog.sources[0]!,
        { ...initialCatalog.sources[2]!, enabled: false },
        { id: 'archive', provider: 'local', mountPath: '/archive', root: './archive', enabled: true },
      ],
    });
    await writeFile(catalogPath, JSON.stringify(revisedCatalog));
    const afterRevision = await createSourceRuntime({
      catalog: await loadCatalog(catalogPath),
      catalogPath,
      ledgerPath,
      environment: testEnvironment,
      driveFilesystemFactory: factory,
    });
    await expect(afterRevision.inspect('policies', 'guide.md')).rejects.toThrow('not active');
    await expect(afterRevision.inspect('processes', 'guide.md')).rejects.toThrow('not active');
    expect((await afterRevision.inspect('archive', 'guide.md')).content).toContain('board minutes');
    expect((await first.inspect('policies', 'guide.md')).content).toContain('seven years');
    expect((await first.inspect('processes', 'guide.md')).content).toContain('records staff');

    const reenabledCatalog = catalog({
      sources: [
        initialCatalog.sources[2]!,
        { id: 'archive', provider: 'local', mountPath: '/archive', root: './archive', enabled: true },
        initialCatalog.sources[1]!,
        initialCatalog.sources[0]!,
      ],
    });
    await writeFile(catalogPath, JSON.stringify(reenabledCatalog));
    const reordered = await createSourceRuntime({
      catalog: await loadCatalog(catalogPath),
      catalogPath,
      ledgerPath,
      environment: testEnvironment,
      driveFilesystemFactory: factory,
    });
    expect((await first.inspect('policies', 'guide.md')).content).toContain('seven years');
    expect(await reordered.inspect('policies', 'guide.md')).toMatchObject({
      sourceId: 'policies',
      mountPath: '/drive/policies',
      content: expect.stringContaining('seven years'),
    });
    expect(await reordered.inspect('processes', 'guide.md')).toMatchObject({
      sourceId: 'processes',
      mountPath: '/drive/processes',
      content: expect.stringContaining('records staff'),
    });
    expect((await reordered.inspect('archive', 'guide.md')).content).toContain('board minutes');

    const remappedCatalog = catalog({
      sources: reenabledCatalog.sources.map(source =>
        source.id === 'policies' ? { ...source, folderId: 'different-folder' } : source,
      ),
    });
    await writeFile(catalogPath, JSON.stringify(remappedCatalog));
    await expect(
      createSourceRuntime({
        catalog: await loadCatalog(catalogPath),
        catalogPath,
        ledgerPath,
        environment: testEnvironment,
        driveFilesystemFactory: factory,
      }),
    ).rejects.toThrow('changed provider or root');
    await writeFile(catalogPath, JSON.stringify(reenabledCatalog));
    const recovered = await createSourceRuntime({
      catalog: await loadCatalog(catalogPath),
      catalogPath,
      ledgerPath,
      environment: testEnvironment,
      driveFilesystemFactory: factory,
    });
    expect((await recovered.inspect('policies', 'guide.md')).content).toContain('seven years');

    const constructorCatalog = catalog({
      sources: [{ id: 'constructor', provider: 'local', mountPath: '/constructor', root: './sample', enabled: true }],
    });
    const constructorLedger = join(directory, 'state', 'constructor-ledger.json');
    const firstConstructor = await createSourceRuntime({
      catalog: constructorCatalog,
      catalogPath,
      ledgerPath: constructorLedger,
      environment: testEnvironment,
    });
    const secondConstructor = await createSourceRuntime({
      catalog: constructorCatalog,
      catalogPath,
      ledgerPath: constructorLedger,
      environment: testEnvironment,
    });
    expect((await firstConstructor.inspect('constructor', 'guide.md')).content).toContain('records office');
    expect((await secondConstructor.inspect('constructor', 'guide.md')).status).toBe('available');
  });

  it('runs the source inspection workflow and sanitizes Drive denial', async () => {
    await prepareSources();
    const localCatalog = catalog({
      sources: [{ id: 'sample', provider: 'local', mountPath: '/sample', root: './sample', enabled: true }],
    });
    const runtime = await createSourceRuntime({
      catalog: localCatalog,
      catalogPath: join(directory, 'source-catalog.json'),
      ledgerPath: join(directory, 'state', 'ledger.json'),
      environment: testEnvironment,
    });
    const workflow = createSourceInspectionWorkflow(runtime);
    const run = await workflow.createRun();
    const result = await run.start({ inputData: { sourceId: 'sample', path: 'overview.md' } });
    expect(result).toMatchObject({ status: 'success', result: { sourceId: 'sample', status: 'available' } });

    installGoogleDriveResponses(true);
    const deniedRuntime = await createSourceRuntime({
      catalog: catalog({ sources: [catalog().sources[1]!] }),
      catalogPath: join(directory, 'source-catalog.json'),
      ledgerPath: join(directory, 'state', 'denied-ledger.json'),
      environment: testEnvironment,
      driveFilesystemFactory: googleDriveFactory([]),
    });
    const denied = await deniedRuntime.inspect('policies', 'guide.md');
    expect(denied).toEqual({
      sourceId: 'policies',
      mountPath: '/drive/policies',
      status: 'unavailable',
      error: 'Source policies is unavailable. Confirm its configured credentials and folder access.',
    });
    expect(JSON.stringify(denied)).not.toContain('private-token');
  });
});
