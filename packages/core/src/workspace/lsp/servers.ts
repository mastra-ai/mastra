/**
 * Built-in LSP Server Definitions
 *
 * Defines how to locate language servers and build command strings for supported languages.
 * Server definitions are pure data — they don't spawn processes themselves.
 * The LSPClient uses a SandboxProcessManager to spawn from these command strings.
 */

import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, parse } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getLanguageId } from './language';
import type { CustomLSPServer, LSPConfig, LSPServerDef } from './types';

/** Check if a binary exists on PATH. */
function whichSync(binary: string): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFileSync(cmd, [binary], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Try to resolve a module from the given directory, then fall back to process.cwd().
 * Returns the createRequire instance that succeeded, or null.
 */
function resolveRequire(root: string, moduleId: string): { require: NodeRequire; resolved: string } | null {
  // Try from root first
  try {
    const req = createRequire(pathToFileURL(join(root, 'package.json')));
    return { require: req, resolved: req.resolve(moduleId) };
  } catch {
    // fall through
  }
  // Try from cwd as fallback
  try {
    const req = createRequire(pathToFileURL(join(process.cwd(), 'package.json')));
    return { require: req, resolved: req.resolve(moduleId) };
  } catch {
    return null;
  }
}

/**
 * Extend resolveRequire to also search additional directories after root and cwd.
 * Each entry in searchPaths should be a directory whose node_modules contains the module.
 */
function resolveRequireFromPaths(
  root: string,
  moduleId: string,
  searchPaths?: string[],
): { require: NodeRequire; resolved: string } | null {
  const fromBase = resolveRequire(root, moduleId);
  if (fromBase) return fromBase;

  for (const searchPath of searchPaths ?? []) {
    try {
      const req = createRequire(pathToFileURL(join(searchPath, 'package.json')));
      return { require: req, resolved: req.resolve(moduleId) };
    } catch {
      // try next
    }
  }

  return null;
}

/** Find a binary in node_modules/.bin, searching root, cwd, then any searchPaths. */
function resolveNodeBin(root: string, binary: string, searchPaths?: string[]): string | undefined {
  const local = join(root, 'node_modules', '.bin', binary);
  const cwd = join(process.cwd(), 'node_modules', '.bin', binary);
  if (existsSync(local)) return local;
  if (existsSync(cwd)) return cwd;
  for (const dir of searchPaths ?? []) {
    const p = join(dir, 'node_modules', '.bin', binary);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Walk up from a starting directory looking for any of the given markers.
 * Returns the first directory that contains a marker, or null.
 */
export function walkUp(startDir: string, markers: string[]): string | null {
  let current = startDir;
  const fsRoot = parse(current).root;

  while (true) {
    for (const marker of markers) {
      if (existsSync(join(current, marker))) {
        return current;
      }
    }
    if (current === fsRoot) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Async version of walkUp that uses a filesystem's exists() method.
 * Works with any filesystem (local, S3, GCS, composite) that implements exists().
 */
export async function walkUpAsync(
  startDir: string,
  markers: string[],
  fs: { exists(path: string): Promise<boolean> },
): Promise<string | null> {
  let current = startDir;
  const fsRoot = parse(current).root;

  while (true) {
    for (const marker of markers) {
      if (await fs.exists(join(current, marker))) {
        return current;
      }
    }
    if (current === fsRoot) break;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/** Default markers used to find a project root when no server-specific markers are available. */
const DEFAULT_MARKERS = [
  'tsconfig.json',
  'package.json',
  'pyproject.toml',
  'go.mod',
  'Cargo.toml',
  'composer.json',
  '.git',
];

/**
 * Find a project root by walking up from a starting directory.
 * Uses default markers (tsconfig.json, package.json, go.mod, etc.).
 * Used by Workspace to resolve the default LSP root at construction time.
 */
export function findProjectRoot(startDir: string): string | null {
  return walkUp(startDir, DEFAULT_MARKERS);
}

/**
 * Async version of findProjectRoot that uses a filesystem's exists() method.
 * Works with any filesystem (local, S3, GCS, composite) that implements exists().
 */
export async function findProjectRootAsync(
  startDir: string,
  fs: { exists(path: string): Promise<boolean> },
): Promise<string | null> {
  return walkUpAsync(startDir, DEFAULT_MARKERS, fs);
}

/**
 * Build an extension → language ID map from custom server definitions.
 * Each extension is mapped to the first language ID of the server that declares it.
 *
 * When multiple servers declare the same extension, the last server wins
 * (iteration order of `Object.values`). A warning is emitted on collision
 * so the user can spot misconfiguration.
 */
export function buildCustomExtensions(servers?: Record<string, CustomLSPServer>): Record<string, string> {
  if (!servers) return {};
  const extensions: Record<string, string> = {};
  for (const server of Object.values(servers)) {
    const languageId = server.languageIds[0];
    if (!languageId) continue;
    for (const ext of server.extensions) {
      const existing = extensions[ext];
      if (existing && existing !== languageId) {
        console.warn(
          `[LSP] Extension "${ext}" is claimed by language "${existing}" and "${languageId}" (server "${server.id}") — using "${languageId}"`,
        );
      }
      extensions[ext] = languageId;
    }
  }
  return extensions;
}

/**
 * Convert a public custom server config to an internal server definition.
 */
function toServerDef(custom: CustomLSPServer): LSPServerDef {
  return {
    id: custom.id,
    name: custom.name,
    languageIds: custom.languageIds,
    markers: custom.markers,
    command: () => custom.command,
    initialization: custom.initializationOptions ? () => custom.initializationOptions! : undefined,
  };
}

/**
 * Build a set of server definitions that incorporate LSP config overrides.
 *
 * Resolution order per server:
 *  1. `config.binaryOverrides[id]` — explicit binary command override
 *  2. Project `node_modules/.bin/` binary
 *  3. `process.cwd()` `node_modules/.bin/` binary
 *  4. `config.searchPaths` `node_modules/.bin/` binary lookup
 *  5. Global PATH lookup (system-installed binaries)
 *  6. `config.packageRunner` — package runner fallback (off by default)
 *
 * `config.searchPaths` also extends TypeScript module resolution
 * (used to locate typescript/lib/tsserver.js when it lives outside the project).
 *
 * When `config.servers` is provided, custom servers are merged after built-in
 * definitions. Custom servers with the same ID as a built-in will replace it.
 */
export function buildServerDefs(config?: LSPConfig): Record<string, LSPServerDef> {
  const { binaryOverrides, searchPaths, packageRunner } = config ?? {};

  const builtins: Record<string, LSPServerDef> = {
    typescript: {
      id: 'typescript',
      name: 'TypeScript Language Server',
      languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
      markers: ['tsconfig.json', 'package.json'],
      command: (root: string): string | undefined => {
        if (binaryOverrides?.typescript) return binaryOverrides.typescript;
        if (!resolveRequireFromPaths(root, 'typescript/lib/tsserver.js', searchPaths)) return undefined;
        const bin = resolveNodeBin(root, 'typescript-language-server', searchPaths);
        if (bin) return `${bin} --stdio`;
        if (whichSync('typescript-language-server')) return 'typescript-language-server --stdio';
        if (packageRunner) return `${packageRunner} typescript-language-server --stdio`;
        return undefined;
      },
      initialization: (root: string) => {
        const ts = resolveRequireFromPaths(root, 'typescript/lib/tsserver.js', searchPaths);
        if (!ts) return undefined;
        return { tsserver: { path: ts.resolved, logVerbosity: 'off' } };
      },
    },

    eslint: {
      id: 'eslint',
      name: 'ESLint Language Server',
      languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
      markers: [
        'package.json',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc.yml',
        '.eslintrc.yaml',
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.ts',
      ],
      command: (root: string): string | undefined => {
        if (binaryOverrides?.eslint) return binaryOverrides.eslint;
        const bin = resolveNodeBin(root, 'vscode-eslint-language-server', searchPaths);
        if (bin) return `${bin} --stdio`;
        if (whichSync('vscode-eslint-language-server')) return 'vscode-eslint-language-server --stdio';
        if (packageRunner) return `${packageRunner} vscode-eslint-language-server --stdio`;
        return undefined;
      },
    },

    python: {
      id: 'python',
      name: 'Python Language Server (Pyright)',
      languageIds: ['python'],
      markers: ['pyproject.toml', 'setup.py', 'requirements.txt', 'setup.cfg'],
      command: (root: string): string | undefined => {
        if (binaryOverrides?.python) return binaryOverrides.python;
        const bin = resolveNodeBin(root, 'pyright-langserver', searchPaths);
        if (bin) return `${bin} --stdio`;
        if (whichSync('pyright-langserver')) return 'pyright-langserver --stdio';
        if (packageRunner) return `${packageRunner} pyright-langserver --stdio`;
        return undefined;
      },
    },

    go: {
      id: 'go',
      name: 'Go Language Server (gopls)',
      languageIds: ['go'],
      markers: ['go.mod'],
      command: (): string | undefined => {
        if (binaryOverrides?.go) return binaryOverrides.go;
        return whichSync('gopls') ? 'gopls serve' : undefined;
      },
    },

    rust: {
      id: 'rust',
      name: 'Rust Language Server (rust-analyzer)',
      languageIds: ['rust'],
      markers: ['Cargo.toml'],
      command: (): string | undefined => {
        if (binaryOverrides?.rust) return binaryOverrides.rust;
        return whichSync('rust-analyzer') ? 'rust-analyzer --stdio' : undefined;
      },
    },
  };

  if (config?.servers) {
    for (const custom of Object.values(config.servers)) {
      builtins[custom.id] = toServerDef(custom);
    }
  }

  return builtins;
}

/**
 * Built-in LSP server definitions with no config overrides.
 * Use `buildServerDefs(config)` when you need binaryOverrides, searchPaths, or packageRunner.
 */
export const BUILTIN_SERVERS: Record<string, LSPServerDef> = buildServerDefs();

/**
 * Get all server definitions that can handle the given file.
 * Filters by language ID match only — the manager resolves the root and checks command availability.
 * Pass `defs` to use config-aware server definitions from `buildServerDefs()`.
 * Pass `customExtensions` to recognize file extensions registered by custom servers.
 */
export function getServersForFile(
  filePath: string,
  disabledServers?: string[],
  defs?: Record<string, LSPServerDef>,
  customExtensions?: Record<string, string>,
): LSPServerDef[] {
  const languageId = getLanguageId(filePath, customExtensions);
  if (!languageId) return [];

  const disabled = new Set(disabledServers ?? []);
  const servers = defs ?? BUILTIN_SERVERS;

  return Object.values(servers).filter(server => !disabled.has(server.id) && server.languageIds.includes(languageId));
}
