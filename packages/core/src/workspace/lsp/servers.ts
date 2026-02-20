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
import { join, dirname, parse } from 'node:path';
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
 * Walk up from `cwd` looking for one of the given marker files/dirs.
 * Returns the directory containing the first match, or null.
 */
export function findNearestRoot(cwd: string, markers: string[]): string | null {
  let current = cwd;
  const root = parse(current).root;

  while (current !== root) {
    for (const marker of markers) {
      if (existsSync(join(current, marker))) {
        return current;
      }
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  return null;
}

/**
 * Built-in LSP server definitions.
 */
export const BUILTIN_SERVERS: Record<string, LSPServerDef> = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript Language Server',
    languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
    root: (cwd: string) => findNearestRoot(cwd, ['tsconfig.json', 'package.json']),
    command: (root: string) => {
      // Resolve TypeScript from the project directory
      const requireFromRoot = createRequire(pathToFileURL(join(root, 'package.json')));
      let tsserver: string | undefined;
      try {
        tsserver = requireFromRoot.resolve('typescript/lib/tsserver.js');
      } catch {
        tsserver = undefined;
      }
      if (!tsserver) return undefined;

      // Resolve typescript-language-server binary directly
      const localBin = join(root, 'node_modules', '.bin', 'typescript-language-server');
      const cwdBin = join(process.cwd(), 'node_modules', '.bin', 'typescript-language-server');
      if (existsSync(localBin)) {
        return `${localBin} --stdio`;
      } else if (existsSync(cwdBin)) {
        return `${cwdBin} --stdio`;
      }
      return undefined;
    },
    initialization: (root: string) => {
      const requireFromRoot = createRequire(pathToFileURL(join(root, 'package.json')));
      let tsserver: string | undefined;
      try {
        tsserver = requireFromRoot.resolve('typescript/lib/tsserver.js');
      } catch {
        tsserver = undefined;
      }
      if (!tsserver) return undefined;
      return {
        tsserver: {
          path: tsserver,
          logVerbosity: 'off',
        },
      };
    },
  },

  eslint: {
    id: 'eslint',
    name: 'ESLint Language Server',
    languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
    root: (cwd: string) =>
      findNearestRoot(cwd, [
        'package.json',
        '.eslintrc.js',
        '.eslintrc.json',
        '.eslintrc.yml',
        '.eslintrc.yaml',
        'eslint.config.js',
        'eslint.config.mjs',
        'eslint.config.cjs',
      ]),
    command: () => {
      const binaryPath = join(process.cwd(), 'node_modules', '.bin', 'vscode-eslint-language-server');
      if (!existsSync(binaryPath)) return undefined;
      return `${binaryPath} --stdio`;
    },
  },

  python: {
    id: 'python',
    name: 'Python Language Server (Pyright)',
    languageIds: ['python'],
    root: (cwd: string) => findNearestRoot(cwd, ['pyproject.toml', 'setup.py', 'requirements.txt', '.git']),
    command: () => {
      const localPath = join(process.cwd(), 'node_modules', '.bin', 'pyright-langserver');
      if (existsSync(localPath)) return `${localPath} --stdio`;
      return whichSync('pyright-langserver') ? 'pyright-langserver --stdio' : undefined;
    },
  },

  go: {
    id: 'go',
    name: 'Go Language Server (gopls)',
    languageIds: ['go'],
    root: (cwd: string) => findNearestRoot(cwd, ['go.mod', '.git']),
    command: () => {
      return whichSync('gopls') ? 'gopls serve' : undefined;
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust Language Server (rust-analyzer)',
    languageIds: ['rust'],
    root: (cwd: string) => findNearestRoot(cwd, ['Cargo.toml', '.git']),
    command: () => {
      return whichSync('rust-analyzer') ? 'rust-analyzer --stdio' : undefined;
    },
  },
};

/**
 * Get all server definitions that can handle the given file.
 * Filters by language ID match and root directory resolution.
 */
export function getServersForFile(filePath: string, cwd: string, disabledServers?: string[]): LSPServerDef[] {
  const languageId = getLanguageId(filePath);
  if (!languageId) return [];

  const disabled = new Set(disabledServers ?? []);

  return Object.values(BUILTIN_SERVERS).filter(
    server => !disabled.has(server.id) && server.languageIds.includes(languageId) && server.root(cwd) !== null,
  );
}
