import { readFile } from 'node:fs/promises';
import { intersects } from 'semver';
import { expect, it } from 'vitest';

const packageRoot = new URL('../../', import.meta.url);

/**
 * Required peers of our runtime dependencies that are intentionally NOT declared by
 * @mastra/mcp. Every entry needs a justification: an undeclared required peer crashes
 * consumers whose package manager skips automatic peer installation (e.g. npm with
 * --legacy-peer-deps), see https://github.com/mastra-ai/mastra/issues/21974.
 */
const UNDECLARED_PEER_ALLOWLIST: Record<string, string> = {
  zod: 'always resolvable: @modelcontextprotocol/sdk and @mastra/core (our required peer) ship zod as a regular dependency',
};

async function readPackageJson(url: URL): Promise<Record<string, any>> {
  return JSON.parse(await readFile(url, 'utf8'));
}

it('declares every required peer of its runtime dependencies (#21974)', async () => {
  const pkg = await readPackageJson(new URL('package.json', packageRoot));
  const problems: string[] = [];

  for (const depName of Object.keys(pkg.dependencies)) {
    const depPkg = await readPackageJson(new URL(`node_modules/${depName}/package.json`, packageRoot));

    for (const [peerName, peerRange] of Object.entries<string>(depPkg.peerDependencies ?? {})) {
      if (depPkg.peerDependenciesMeta?.[peerName]?.optional) continue;
      // A peer the dependency also ships as a regular dependency is always resolvable.
      if (depPkg.dependencies?.[peerName]) continue;

      const declaredRange = pkg.dependencies[peerName] ?? pkg.peerDependencies?.[peerName];
      if (declaredRange) {
        if (!intersects(declaredRange, peerRange, { includePrerelease: true })) {
          problems.push(
            `${depName} requires peer ${peerName}@${peerRange}, but @mastra/mcp declares ${peerName}@${declaredRange}, which never satisfies it`,
          );
        }
        continue;
      }

      if (peerName in UNDECLARED_PEER_ALLOWLIST) continue;

      problems.push(
        `${depName} requires peer ${peerName}@${peerRange}, but @mastra/mcp neither declares it nor allowlists it. ` +
          `Consumers installing with npm --legacy-peer-deps will crash at import time if the peer is loaded eagerly. ` +
          `Declare it in dependencies, or add it to UNDECLARED_PEER_ALLOWLIST with a justification.`,
      );
    }
  }

  expect(problems, problems.join('\n')).toEqual([]);
});
