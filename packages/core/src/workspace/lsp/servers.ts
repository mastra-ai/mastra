/**
 * Built-in LSP Server Definitions
 *
 * Defines how to spawn and locate language servers for supported languages.
 * Requires Node.js APIs (child_process, fs, path).
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, parse } from 'node:path';
import { pathToFileURL } from 'node:url';

import { getLanguageId } from './language';
import type { LSPServerDef } from './types';

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
    spawn: async (root: string) => {
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
      let tslsBinary: string;
      if (existsSync(localBin)) {
        tslsBinary = localBin;
      } else if (existsSync(cwdBin)) {
        tslsBinary = cwdBin;
      } else {
        tslsBinary = 'npx';
      }

      const args = tslsBinary === 'npx' ? ['typescript-language-server', '--stdio'] : ['--stdio'];

      const proc = spawn(tslsBinary, args, {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        process: proc,
        initialization: {
          tsserver: {
            path: tsserver,
            logVerbosity: 'off',
          },
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
    spawn: (root: string) => {
      const binaryPath = join(process.cwd(), 'node_modules', '.bin', 'vscode-eslint-language-server');
      return spawn(binaryPath, ['--stdio'], {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },
  },

  python: {
    id: 'python',
    name: 'Python Language Server (Pyright)',
    languageIds: ['python'],
    root: (cwd: string) => findNearestRoot(cwd, ['pyproject.toml', 'setup.py', 'requirements.txt', '.git']),
    spawn: (root: string) => {
      const localPath = join(process.cwd(), 'node_modules', '.bin', 'pyright-langserver');
      const binaryPath = existsSync(localPath) ? localPath : 'pyright-langserver';
      return spawn(binaryPath, ['--stdio'], {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },
  },

  go: {
    id: 'go',
    name: 'Go Language Server (gopls)',
    languageIds: ['go'],
    root: (cwd: string) => findNearestRoot(cwd, ['go.mod', '.git']),
    spawn: (root: string) => {
      return spawn('gopls', ['serve'], {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust Language Server (rust-analyzer)',
    languageIds: ['rust'],
    root: (cwd: string) => findNearestRoot(cwd, ['Cargo.toml', '.git']),
    spawn: (root: string) => {
      return spawn('rust-analyzer', ['--stdio'], {
        cwd: root,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
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
