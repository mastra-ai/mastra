// Node `--import` hook for processes a test spawns outside Vitest: resolves exported workspace
// package imports to source the same way the Vitest plugin does. The Vitest wrapper passes it to
// spawned processes through NODE_OPTIONS. It only applies where tsx is loaded, since plain Node
// (including Vitest's own workers) can't run the TypeScript source.
// Does nothing in CI, where children load built packages.
import { registerHooks } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createWorkspacePackageIndex, findWorkspaceRoot, resolveWorkspaceSource } from './vitest-source-resolver.js';

const nodeArgs = [...process.execArgv, ...(process.env.NODE_OPTIONS ?? '').split(/\s+/)];
const loadsTsx = nodeArgs.some(arg => /[\\/=]tsx(?:[\\/@]|$)|^tsx(?:\/|$)/.test(arg));

if (!process.env.CI && loadsTsx) {
  const index = createWorkspacePackageIndex(findWorkspaceRoot());

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const importer = context.parentURL?.startsWith('file:') ? fileURLToPath(context.parentURL) : undefined;
      const resolved = resolveWorkspaceSource(specifier, index, importer);
      if (resolved) return { url: pathToFileURL(resolved.path).href + resolved.query, shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
}
