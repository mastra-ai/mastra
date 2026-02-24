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
import type { LSPServerDef } from './types';

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
 * Built-in LSP server definitions.
 */
export const BUILTIN_SERVERS: Record<string, LSPServerDef> = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript Language Server',
    languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
    markers: ['tsconfig.json', 'package.json'],
    command: (root: string) => {
      const ts = resolveRequire(root, 'typescript/lib/tsserver.js');
      if (!ts) return undefined;

      // Find typescript-language-server binary: root node_modules, then cwd node_modules
      const localBin = join(root, 'node_modules', '.bin', 'typescript-language-server');
      const cwdBin = join(process.cwd(), 'node_modules', '.bin', 'typescript-language-server');
      if (existsSync(localBin)) return `${localBin} --stdio`;
      if (existsSync(cwdBin)) return `${cwdBin} --stdio`;
      return undefined;
    },
    initialization: (root: string) => {
      const ts = resolveRequire(root, 'typescript/lib/tsserver.js');
      if (!ts) return undefined;
      return {
        tsserver: {
          path: ts.resolved,
          logVerbosity: 'off',
        },
      };
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
    command: (root: string) => {
      const localBin = join(root, 'node_modules', '.bin', 'vscode-eslint-language-server');
      const cwdBin = join(process.cwd(), 'node_modules', '.bin', 'vscode-eslint-language-server');
      if (existsSync(localBin)) return `${localBin} --stdio`;
      if (existsSync(cwdBin)) return `${cwdBin} --stdio`;
      return undefined;
    },
  },

  python: {
    id: 'python',
    name: 'Python Language Server (Pyright)',
    languageIds: ['python'],
    markers: ['pyproject.toml', 'setup.py', 'requirements.txt', 'setup.cfg'],
    command: (root: string) => {
      const localBin = join(root, 'node_modules', '.bin', 'pyright-langserver');
      const cwdBin = join(process.cwd(), 'node_modules', '.bin', 'pyright-langserver');
      if (existsSync(localBin)) return `${localBin} --stdio`;
      if (existsSync(cwdBin)) return `${cwdBin} --stdio`;
      return whichSync('pyright-langserver') ? 'pyright-langserver --stdio' : undefined;
    },
  },

  go: {
    id: 'go',
    name: 'Go Language Server (gopls)',
    languageIds: ['go'],
    markers: ['go.mod'],
    command: () => {
      return whichSync('gopls') ? 'gopls serve' : undefined;
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust Language Server (rust-analyzer)',
    languageIds: ['rust'],
    markers: ['Cargo.toml'],
    command: () => {
      return whichSync('rust-analyzer') ? 'rust-analyzer --stdio' : undefined;
    },
  },
};

/**
 * Get all server definitions that can handle the given file.
 * Filters by language ID match only — the manager resolves the root and checks command availability.
 */
export function getServersForFile(filePath: string, disabledServers?: string[]): LSPServerDef[] {
  const languageId = getLanguageId(filePath);
  if (!languageId) return [];

  const disabled = new Set(disabledServers ?? []);

  return Object.values(BUILTIN_SERVERS).filter(
    server => !disabled.has(server.id) && server.languageIds.includes(languageId),
  );
}
