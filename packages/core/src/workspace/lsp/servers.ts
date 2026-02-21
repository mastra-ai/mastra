/**
 * Built-in LSP Server Definitions
 *
 * Defines how to locate language servers and build command strings for supported languages.
 * Server definitions are pure data — they don't spawn processes themselves.
 * The LSPClient uses a SandboxProcessManager to spawn from these command strings.
 */

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
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
 * Built-in LSP server definitions.
 */
export const BUILTIN_SERVERS: Record<string, LSPServerDef> = {
  typescript: {
    id: 'typescript',
    name: 'TypeScript Language Server',
    languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
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

      // Resolve typescript-language-server binary from the project root
      let tslsBin: string | undefined;
      try {
        tslsBin = requireFromRoot.resolve('typescript-language-server/lib/cli.mjs');
        // requireFromRoot gives us the module path — we need the bin wrapper
        tslsBin = join(root, 'node_modules', '.bin', 'typescript-language-server');
      } catch {
        tslsBin = undefined;
      }
      if (!tslsBin) return undefined;
      return `${tslsBin} --stdio`;
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
    command: (root: string) => {
      const requireFromRoot = createRequire(pathToFileURL(join(root, 'package.json')));
      try {
        requireFromRoot.resolve('vscode-eslint-language-server');
        return `${join(root, 'node_modules', '.bin', 'vscode-eslint-language-server')} --stdio`;
      } catch {
        return undefined;
      }
    },
  },

  python: {
    id: 'python',
    name: 'Python Language Server (Pyright)',
    languageIds: ['python'],
    command: (root: string) => {
      const requireFromRoot = createRequire(pathToFileURL(join(root, 'package.json')));
      try {
        requireFromRoot.resolve('pyright');
        return `${join(root, 'node_modules', '.bin', 'pyright-langserver')} --stdio`;
      } catch {
        return whichSync('pyright-langserver') ? 'pyright-langserver --stdio' : undefined;
      }
    },
  },

  go: {
    id: 'go',
    name: 'Go Language Server (gopls)',
    languageIds: ['go'],
    command: () => {
      return whichSync('gopls') ? 'gopls serve' : undefined;
    },
  },

  rust: {
    id: 'rust',
    name: 'Rust Language Server (rust-analyzer)',
    languageIds: ['rust'],
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
