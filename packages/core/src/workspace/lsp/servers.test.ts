import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  BUILTIN_SERVERS,
  buildCustomExtensions,
  buildServerDefs,
  findProjectRoot,
  findProjectRootAsync,
  getServersForFile,
  walkUp,
  walkUpAsync,
} from './servers';

/** Helper to create a mock filesystem from a set of existing paths */
function mockFs(existingPaths: Set<string>): { exists(path: string): Promise<boolean> } {
  return {
    exists: async (p: string) => existingPaths.has(p),
  };
}

describe('walkUp', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-walkup-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds closest marker', () => {
    // tempDir/a/b/c with package.json at tempDir/a
    const a = join(tempDir, 'a');
    const b = join(a, 'b');
    const c = join(b, 'c');
    mkdirSync(c, { recursive: true });
    writeFileSync(join(a, 'package.json'), '{}');

    expect(walkUp(c, ['package.json'])).toBe(a);
  });

  it('finds marker in the starting directory itself', () => {
    writeFileSync(join(tempDir, 'tsconfig.json'), '{}');

    expect(walkUp(tempDir, ['tsconfig.json'])).toBe(tempDir);
  });

  it('prefers closest match over parent', () => {
    // Both parent and child have package.json — should find child
    const parent = join(tempDir, 'parent');
    const child = join(parent, 'child');
    const deep = join(child, 'src');
    mkdirSync(deep, { recursive: true });
    writeFileSync(join(parent, 'package.json'), '{}');
    writeFileSync(join(child, 'package.json'), '{}');

    expect(walkUp(deep, ['package.json'])).toBe(child);
  });

  it('returns null when no marker found', () => {
    const deep = join(tempDir, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });

    expect(walkUp(deep, ['nonexistent-marker.json'])).toBeNull();
  });

  it('checks multiple markers', () => {
    const dir = join(tempDir, 'project');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'go.mod'), 'module example');

    expect(walkUp(dir, ['package.json', 'go.mod'])).toBe(dir);
  });

  it('stops at filesystem root without infinite loop', () => {
    // walkUp from a shallow path should not hang
    const result = walkUp('/tmp', ['definitely-not-a-real-marker-file-xyz']);
    expect(result).toBeNull();
  });

  it('checks the filesystem root itself for markers', () => {
    // If a marker exists at the fs root, walkUp should find it
    // We use tempDir as a stand-in since we can't write to /
    const child = join(tempDir, 'child');
    mkdirSync(child, { recursive: true });
    writeFileSync(join(tempDir, 'package.json'), '{}');

    // Walking up from child should find tempDir (closest marker)
    expect(walkUp(child, ['package.json'])).toBe(tempDir);
  });
});

describe('findProjectRoot', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-root-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('finds tsconfig.json', () => {
    const project = join(tempDir, 'project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'tsconfig.json'), '{}');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds package.json', () => {
    const project = join(tempDir, 'project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'package.json'), '{}');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds go.mod', () => {
    const project = join(tempDir, 'go-project');
    const pkg = join(project, 'pkg');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(project, 'go.mod'), 'module example');

    expect(findProjectRoot(pkg)).toBe(project);
  });

  it('finds Cargo.toml', () => {
    const project = join(tempDir, 'rust-project');
    const src = join(project, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(project, 'Cargo.toml'), '[package]');

    expect(findProjectRoot(src)).toBe(project);
  });

  it('finds .git directory', () => {
    const project = join(tempDir, 'git-project');
    const src = join(project, 'src');
    const gitDir = join(project, '.git');
    mkdirSync(src, { recursive: true });
    mkdirSync(gitDir, { recursive: true });

    expect(findProjectRoot(src)).toBe(project);
  });

  it('returns null when nothing found', () => {
    const deep = join(tempDir, 'a', 'b', 'c');
    mkdirSync(deep, { recursive: true });

    expect(findProjectRoot(deep)).toBeNull();
  });
});

describe('getServersForFile', () => {
  it('returns TypeScript server for .ts files', () => {
    const servers = getServersForFile('/project/src/app.ts');
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns TypeScript server for .tsx files', () => {
    const servers = getServersForFile('/project/src/App.tsx');
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns TypeScript server for .js files', () => {
    const servers = getServersForFile('/project/src/app.js');
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('returns Python server for .py files', () => {
    const servers = getServersForFile('/project/main.py');
    expect(servers.some(s => s.id === 'python')).toBe(true);
  });

  it('returns Go server for .go files', () => {
    const servers = getServersForFile('/project/main.go');
    expect(servers.some(s => s.id === 'go')).toBe(true);
  });

  it('returns Rust server for .rs files', () => {
    const servers = getServersForFile('/project/src/main.rs');
    expect(servers.some(s => s.id === 'rust')).toBe(true);
  });

  it('returns empty array for files with no matching server', () => {
    // .png has no language mapping at all
    expect(getServersForFile('/project/image.png')).toEqual([]);
    // .txt has no language mapping
    expect(getServersForFile('/project/notes.txt')).toEqual([]);
  });

  it('returns empty array for mapped languages without a builtin server', () => {
    // .md and .json have language IDs but no BUILTIN_SERVERS entry (yet)
    expect(getServersForFile('/project/README.md')).toEqual([]);
    expect(getServersForFile('/project/data.json')).toEqual([]);
  });

  it('filters disabled servers', () => {
    const servers = getServersForFile('/project/src/app.ts', ['eslint']);
    expect(servers.some(s => s.id === 'eslint')).toBe(false);
    expect(servers.some(s => s.id === 'typescript')).toBe(true);
  });

  it('can disable all matching servers', () => {
    const servers = getServersForFile('/project/main.go', ['go']);
    expect(servers).toEqual([]);
  });

  it('server definitions include markers', () => {
    const tsServers = getServersForFile('/project/app.ts');
    const tsServer = tsServers.find(s => s.id === 'typescript');
    expect(tsServer?.markers).toEqual(['tsconfig.json', 'package.json']);

    const pyServers = getServersForFile('/project/app.py');
    const pyServer = pyServers.find(s => s.id === 'python');
    expect(pyServer?.markers).toEqual(['pyproject.toml', 'setup.py', 'requirements.txt', 'setup.cfg']);

    const goServers = getServersForFile('/project/main.go');
    const goServer = goServers.find(s => s.id === 'go');
    expect(goServer?.markers).toEqual(['go.mod']);

    const rsServers = getServersForFile('/project/main.rs');
    const rsServer = rsServers.find(s => s.id === 'rust');
    expect(rsServer?.markers).toEqual(['Cargo.toml']);
  });
});

describe('walkUpAsync', () => {
  it('finds closest marker', async () => {
    const fs = mockFs(new Set(['/workspace/a/package.json']));
    expect(await walkUpAsync('/workspace/a/b/c', ['package.json'], fs)).toBe('/workspace/a');
  });

  it('finds marker in the starting directory itself', async () => {
    const fs = mockFs(new Set(['/workspace/tsconfig.json']));
    expect(await walkUpAsync('/workspace', ['tsconfig.json'], fs)).toBe('/workspace');
  });

  it('prefers closest match over parent', async () => {
    const fs = mockFs(new Set(['/workspace/parent/package.json', '/workspace/parent/child/package.json']));
    expect(await walkUpAsync('/workspace/parent/child/src', ['package.json'], fs)).toBe('/workspace/parent/child');
  });

  it('returns null when no marker found', async () => {
    const fs = mockFs(new Set());
    expect(await walkUpAsync('/workspace/a/b/c', ['nonexistent.json'], fs)).toBeNull();
  });

  it('checks multiple markers', async () => {
    const fs = mockFs(new Set(['/workspace/project/go.mod']));
    expect(await walkUpAsync('/workspace/project', ['package.json', 'go.mod'], fs)).toBe('/workspace/project');
  });

  it('stops at filesystem root without infinite loop', async () => {
    const fs = mockFs(new Set());
    const result = await walkUpAsync('/tmp', ['definitely-not-a-real-marker-file-xyz'], fs);
    expect(result).toBeNull();
  });

  it('finds marker at filesystem root', async () => {
    const fs = mockFs(new Set(['/package.json']));
    expect(await walkUpAsync('/src/lib', ['package.json'], fs)).toBe('/');
  });

  it('works with composite filesystem mount paths', async () => {
    // Simulates CompositeFilesystem where /s3/src/tsconfig.json exists in S3 mount
    const fs = mockFs(new Set(['/s3/src/tsconfig.json']));
    expect(await walkUpAsync('/s3/src/lib', ['tsconfig.json'], fs)).toBe('/s3/src');
  });

  it('returns null when walking past mount boundary', async () => {
    // Only paths within /s3/ mount exist; parent paths return false
    const fs = mockFs(new Set(['/s3/src/index.ts']));
    expect(await walkUpAsync('/s3/src', ['package.json', 'tsconfig.json'], fs)).toBeNull();
  });
});

describe('findProjectRootAsync', () => {
  it('finds tsconfig.json', async () => {
    const fs = mockFs(new Set(['/project/tsconfig.json']));
    expect(await findProjectRootAsync('/project/src', fs)).toBe('/project');
  });

  it('finds package.json', async () => {
    const fs = mockFs(new Set(['/project/package.json']));
    expect(await findProjectRootAsync('/project/src', fs)).toBe('/project');
  });

  it('finds go.mod', async () => {
    const fs = mockFs(new Set(['/go-project/go.mod']));
    expect(await findProjectRootAsync('/go-project/pkg', fs)).toBe('/go-project');
  });

  it('finds Cargo.toml', async () => {
    const fs = mockFs(new Set(['/rust-project/Cargo.toml']));
    expect(await findProjectRootAsync('/rust-project/src', fs)).toBe('/rust-project');
  });

  it('returns null when nothing found', async () => {
    const fs = mockFs(new Set());
    expect(await findProjectRootAsync('/a/b/c', fs)).toBeNull();
  });
});

describe('BUILTIN_SERVERS command()', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-command-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('typescript', () => {
    const tsCommand = BUILTIN_SERVERS.typescript!.command;

    it('finds binary in root node_modules', () => {
      const bin = join(tempDir, 'node_modules', '.bin', 'typescript-language-server');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      const result = tsCommand(tempDir);
      expect(result).toBe(`${bin} --stdio`);
    });

    it('returns undefined when binary not found', () => {
      // typescript module resolves via cwd fallback, but no binary anywhere
      expect(tsCommand(tempDir)).toBeUndefined();
    });
  });

  describe('typescript initialization()', () => {
    const tsInit = BUILTIN_SERVERS.typescript!.initialization!;

    it('returns tsserver config with resolved path', () => {
      // resolveRequire falls back to cwd where typescript is installed
      const result = tsInit(tempDir);
      expect(result).toBeDefined();
      expect(result.tsserver.path).toContain('tsserver.js');
      expect(result.tsserver.logVerbosity).toBe('off');
    });
  });

  describe('eslint', () => {
    const eslintCommand = BUILTIN_SERVERS.eslint!.command;

    it('finds binary in root node_modules', () => {
      const bin = join(tempDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      expect(eslintCommand(tempDir)).toBe(`${bin} --stdio`);
    });

    it('returns undefined when binary not found', () => {
      expect(eslintCommand(tempDir)).toBeUndefined();
    });
  });

  describe('python', () => {
    const pyCommand = BUILTIN_SERVERS.python!.command;

    it('finds binary in root node_modules', () => {
      const bin = join(tempDir, 'node_modules', '.bin', 'pyright-langserver');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      expect(pyCommand(tempDir)).toBe(`${bin} --stdio`);
    });

    it('returns undefined when no binary or PATH entry found', () => {
      // Skip if pyright-langserver happens to be on PATH
      const result = pyCommand(tempDir);
      if (result === 'pyright-langserver --stdio') return; // on PATH, can't test this case
      expect(result).toBeUndefined();
    });
  });

  describe('go', () => {
    const goCommand = BUILTIN_SERVERS.go!.command;

    it('returns correct command format', () => {
      const result = goCommand(tempDir);
      // Either gopls is on PATH and we get the command, or it's not and we get undefined
      if (result) {
        expect(result).toBe('gopls serve');
      } else {
        expect(result).toBeUndefined();
      }
    });
  });

  describe('rust', () => {
    const rustCommand = BUILTIN_SERVERS.rust!.command;

    it('returns correct command format', () => {
      const result = rustCommand(tempDir);
      if (result) {
        expect(result).toBe('rust-analyzer --stdio');
      } else {
        expect(result).toBeUndefined();
      }
    });
  });
});

describe('buildServerDefs', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'lsp-build-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('binaryOverrides', () => {
    it('returns the override path for typescript without checking node_modules', () => {
      const defs = buildServerDefs({
        binaryOverrides: { typescript: '/usr/local/bin/typescript-language-server --stdio' },
      });
      // Even with no binary in tempDir, override wins
      expect(defs.typescript!.command(tempDir)).toBe('/usr/local/bin/typescript-language-server --stdio');
    });

    it('returns the override path for eslint', () => {
      const defs = buildServerDefs({ binaryOverrides: { eslint: '/opt/bin/vscode-eslint-language-server --stdio' } });
      expect(defs.eslint!.command(tempDir)).toBe('/opt/bin/vscode-eslint-language-server --stdio');
    });

    it('returns the override path for go', () => {
      const defs = buildServerDefs({ binaryOverrides: { go: '/usr/local/bin/gopls serve' } });
      expect(defs.go!.command()).toBe('/usr/local/bin/gopls serve');
    });

    it('returns the override path for rust', () => {
      const defs = buildServerDefs({ binaryOverrides: { rust: '/usr/local/bin/rust-analyzer --stdio' } });
      expect(defs.rust!.command()).toBe('/usr/local/bin/rust-analyzer --stdio');
    });

    it('override takes priority over a local binary', () => {
      const bin = join(tempDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      const defs = buildServerDefs({ binaryOverrides: { eslint: '/custom/path/eslint-server --stdio' } });
      expect(defs.eslint!.command(tempDir)).toBe('/custom/path/eslint-server --stdio');
    });
  });

  describe('packageRunner fallback', () => {
    it('uses the provided runner for eslint when binary not found', () => {
      const defs = buildServerDefs({ packageRunner: 'npx --yes' });
      const result = defs.eslint!.command(tempDir);
      // If vscode-eslint-language-server is on PATH, runner is not needed
      if (result === 'vscode-eslint-language-server --stdio') return;
      expect(result).toBe('npx --yes vscode-eslint-language-server --stdio');
    });

    it('works with pnpm dlx runner', () => {
      const defs = buildServerDefs({ packageRunner: 'pnpm dlx' });
      const result = defs.eslint!.command(tempDir);
      if (result === 'vscode-eslint-language-server --stdio') return;
      expect(result).toBe('pnpm dlx vscode-eslint-language-server --stdio');
    });

    it('works with bunx runner', () => {
      const defs = buildServerDefs({ packageRunner: 'bunx' });
      const result = defs.eslint!.command(tempDir);
      if (result === 'vscode-eslint-language-server --stdio') return;
      expect(result).toBe('bunx vscode-eslint-language-server --stdio');
    });

    it('uses the provided runner for python after PATH check when no binary found', () => {
      const defs = buildServerDefs({ packageRunner: 'npx --yes' });
      const result = defs.python!.command(tempDir);
      // Either pyright-langserver is on PATH (returns PATH command) or not (returns runner)
      if (result === 'pyright-langserver --stdio') return; // on PATH, runner not needed
      expect(result).toBe('npx --yes pyright-langserver --stdio');
    });

    it('returns undefined when no packageRunner set (default)', () => {
      const defs = buildServerDefs();
      const result = defs.eslint!.command(tempDir);
      // If vscode-eslint-language-server is on PATH, it returns the PATH command
      if (result === 'vscode-eslint-language-server --stdio') return;
      expect(result).toBeUndefined();
    });

    it('local binary takes priority over packageRunner', () => {
      const bin = join(tempDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      const defs = buildServerDefs({ packageRunner: 'npx --yes' });
      expect(defs.eslint!.command(tempDir)).toBe(`${bin} --stdio`);
    });
  });

  describe('searchPaths', () => {
    it('finds typescript/lib/tsserver.js from searchPaths for module resolution', () => {
      // Use a root dir that does NOT contain typescript so resolution can only succeed via searchPaths.
      const emptyRoot = join(tempDir, 'empty-root');
      mkdirSync(emptyRoot, { recursive: true });

      // searchPaths points to cwd (monorepo root) which has typescript installed.
      const defs = buildServerDefs({ searchPaths: [process.cwd()] });
      const init = defs.typescript!.initialization!(emptyRoot);
      expect(init).toBeDefined();
      expect((init as { tsserver: { path: string } }).tsserver.path).toContain('tsserver.js');
    });

    it('finds binary in searchPaths node_modules/.bin', () => {
      // Create a fake binary inside a searchPath directory
      const searchDir = join(tempDir, 'search');
      const bin = join(searchDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(searchDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(bin, '');

      const defs = buildServerDefs({ searchPaths: [searchDir] });
      expect(defs.eslint!.command(tempDir)).toBe(`${bin} --stdio`);
    });

    it('project node_modules takes priority over searchPaths', () => {
      const projectBin = join(tempDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(tempDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(projectBin, '');

      const searchDir = join(tempDir, 'search');
      const searchBin = join(searchDir, 'node_modules', '.bin', 'vscode-eslint-language-server');
      mkdirSync(join(searchDir, 'node_modules', '.bin'), { recursive: true });
      writeFileSync(searchBin, '');

      const defs = buildServerDefs({ searchPaths: [searchDir] });
      expect(defs.eslint!.command(tempDir)).toBe(`${projectBin} --stdio`);
    });
  });

  describe('getServersForFile with custom defs', () => {
    it('uses provided defs instead of BUILTIN_SERVERS', () => {
      const customDefs = buildServerDefs({ binaryOverrides: { typescript: '/custom/tls --stdio' } });
      const servers = getServersForFile('/project/app.ts', undefined, customDefs);
      const ts = servers.find(s => s.id === 'typescript');
      expect(ts).toBeDefined();
      expect(ts!.command('/any/root')).toBe('/custom/tls --stdio');
    });

    it('falls back to BUILTIN_SERVERS when no defs provided', () => {
      const servers = getServersForFile('/project/app.ts');
      expect(servers.some(s => s.id === 'typescript')).toBe(true);
    });
  });

  describe('custom servers via config.servers', () => {
    const phpServer = {
      id: 'phpactor',
      name: 'Phpactor Language Server',
      languageIds: ['php'],
      extensions: ['.php'],
      markers: ['composer.json'],
      command: 'phpactor language-server',
    };

    it('merges custom server into buildServerDefs result', () => {
      const defs = buildServerDefs({ servers: { phpactor: phpServer } });
      expect(defs.phpactor).toBeDefined();
      expect(defs.phpactor!.id).toBe('phpactor');
      expect(defs.phpactor!.name).toBe('Phpactor Language Server');
      expect(defs.phpactor!.languageIds).toEqual(['php']);
      expect(defs.phpactor!.markers).toEqual(['composer.json']);
    });

    it('custom server command is a constant string wrapped as a function', () => {
      const defs = buildServerDefs({ servers: { phpactor: phpServer } });
      expect(defs.phpactor!.command('/any/root')).toBe('phpactor language-server');
    });

    it('preserves built-in servers alongside custom servers', () => {
      const defs = buildServerDefs({ servers: { phpactor: phpServer } });
      expect(defs.typescript).toBeDefined();
      expect(defs.python).toBeDefined();
      expect(defs.go).toBeDefined();
      expect(defs.rust).toBeDefined();
      expect(defs.phpactor).toBeDefined();
    });

    it('custom server overrides built-in with same ID', () => {
      const customGo = {
        id: 'go',
        name: 'Custom Go Server',
        languageIds: ['go'],
        extensions: ['.go'],
        markers: ['go.mod'],
        command: '/custom/gopls serve',
      };
      const defs = buildServerDefs({ servers: { go: customGo } });
      expect(defs.go!.name).toBe('Custom Go Server');
      expect(defs.go!.command('/any')).toBe('/custom/gopls serve');
    });

    it('custom server with initializationOptions exposes initialization()', () => {
      const serverWithInit = {
        ...phpServer,
        initializationOptions: { storagePath: '/tmp/phpactor' },
      };
      const defs = buildServerDefs({ servers: { phpactor: serverWithInit } });
      expect(defs.phpactor!.initialization).toBeDefined();
      expect(defs.phpactor!.initialization!('/any')).toEqual({ storagePath: '/tmp/phpactor' });
    });

    it('custom server without initializationOptions has no initialization()', () => {
      const defs = buildServerDefs({ servers: { phpactor: phpServer } });
      expect(defs.phpactor!.initialization).toBeUndefined();
    });

    it('multiple custom servers can be registered', () => {
      const rubyServer = {
        id: 'solargraph',
        name: 'Solargraph',
        languageIds: ['ruby'],
        extensions: ['.rb'],
        markers: ['Gemfile'],
        command: 'solargraph stdio',
      };
      const defs = buildServerDefs({ servers: { phpactor: phpServer, solargraph: rubyServer } });
      expect(defs.phpactor).toBeDefined();
      expect(defs.solargraph).toBeDefined();
    });
  });

  describe('buildCustomExtensions', () => {
    it('builds extension map from custom servers', () => {
      const servers = {
        phpactor: {
          id: 'phpactor',
          name: 'Phpactor',
          languageIds: ['php'],
          extensions: ['.php', '.phtml'],
          markers: ['composer.json'],
          command: 'phpactor language-server',
        },
      };
      const extensions = buildCustomExtensions(servers);
      expect(extensions['.php']).toBe('php');
      expect(extensions['.phtml']).toBe('php');
    });

    it('returns empty object when no servers provided', () => {
      expect(buildCustomExtensions(undefined)).toEqual({});
      expect(buildCustomExtensions({})).toEqual({});
    });

    it('maps extensions from multiple servers', () => {
      const servers = {
        phpactor: {
          id: 'phpactor',
          name: 'Phpactor',
          languageIds: ['php'],
          extensions: ['.php'],
          markers: ['composer.json'],
          command: 'phpactor language-server',
        },
        solargraph: {
          id: 'solargraph',
          name: 'Solargraph',
          languageIds: ['ruby'],
          extensions: ['.rb', '.erb'],
          markers: ['Gemfile'],
          command: 'solargraph stdio',
        },
      };
      const extensions = buildCustomExtensions(servers);
      expect(extensions['.php']).toBe('php');
      expect(extensions['.rb']).toBe('ruby');
      expect(extensions['.erb']).toBe('ruby');
    });

    it('skips servers with empty languageIds', () => {
      const servers = {
        broken: {
          id: 'broken',
          name: 'Broken',
          languageIds: [],
          extensions: ['.brk'],
          markers: [],
          command: 'broken-server',
        },
      };
      const extensions = buildCustomExtensions(servers);
      expect(extensions['.brk']).toBeUndefined();
    });
  });

  describe('getServersForFile with customExtensions', () => {
    it('finds custom server for custom extension', () => {
      const defs = buildServerDefs({
        servers: {
          phpactor: {
            id: 'phpactor',
            name: 'Phpactor',
            languageIds: ['php'],
            extensions: ['.php'],
            markers: ['composer.json'],
            command: 'phpactor language-server',
          },
        },
      });
      const customExtensions = { '.php': 'php' };
      const servers = getServersForFile('/project/src/App.php', undefined, defs, customExtensions);
      expect(servers).toHaveLength(1);
      expect(servers[0]!.id).toBe('phpactor');
    });

    it('returns empty for unknown extension even with custom defs', () => {
      const defs = buildServerDefs({
        servers: {
          phpactor: {
            id: 'phpactor',
            name: 'Phpactor',
            languageIds: ['php'],
            extensions: ['.php'],
            markers: ['composer.json'],
            command: 'phpactor language-server',
          },
        },
      });
      const servers = getServersForFile('/project/data.xyz', undefined, defs, { '.php': 'php' });
      expect(servers).toEqual([]);
    });

    it('custom extensions work alongside built-in extensions', () => {
      const defs = buildServerDefs({
        servers: {
          phpactor: {
            id: 'phpactor',
            name: 'Phpactor',
            languageIds: ['php'],
            extensions: ['.php'],
            markers: ['composer.json'],
            command: 'phpactor language-server',
          },
        },
      });
      const customExtensions = { '.php': 'php' };

      const phpServers = getServersForFile('/project/App.php', undefined, defs, customExtensions);
      expect(phpServers.some(s => s.id === 'phpactor')).toBe(true);

      const tsServers = getServersForFile('/project/app.ts', undefined, defs, customExtensions);
      expect(tsServers.some(s => s.id === 'typescript')).toBe(true);
    });

    it('disabled servers are filtered from custom servers too', () => {
      const defs = buildServerDefs({
        servers: {
          phpactor: {
            id: 'phpactor',
            name: 'Phpactor',
            languageIds: ['php'],
            extensions: ['.php'],
            markers: ['composer.json'],
            command: 'phpactor language-server',
          },
        },
      });
      const servers = getServersForFile('/project/App.php', ['phpactor'], defs, { '.php': 'php' });
      expect(servers).toEqual([]);
    });
  });
});
