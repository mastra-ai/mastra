import { readFile } from 'node:fs/promises';
import { subset } from 'semver';
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

it('keeps the v2 package compatible with the existing core v1 peer range', async () => {
  const pkg = await readPackageJson(new URL('package.json', packageRoot));

  expect(pkg.peerDependencies?.['@mastra/core']).toBe('>=1.0.0-0 <2.0.0-0');
});

it('widens editor MCP compatibility without making the peer required', async () => {
  const editorPkg = await readPackageJson(new URL('../editor/package.json', packageRoot));

  expect(editorPkg.peerDependencies?.['@mastra/mcp']).toBe('>=1.0.0-0 <3.0.0-0');
  expect(editorPkg.peerDependenciesMeta?.['@mastra/mcp']).toEqual({ optional: true });
});

it('keeps runtime consumers on legacy behavior without changing dev-only consumers', async () => {
  const docsServerPkg = await readPackageJson(new URL('../mcp-docs-server/package.json', packageRoot));
  const docsServerSource = await readFile(new URL('../mcp-docs-server/src/index.ts', packageRoot), 'utf8');
  const registryPkg = await readPackageJson(new URL('../mcp-registry-registry/package.json', packageRoot));

  expect(docsServerPkg.dependencies?.['@mastra/mcp']).toBe('workspace:^');
  expect(docsServerSource).toContain("protocolVersion: '2025-11-25'");
  expect(registryPkg.dependencies?.['@mastra/mcp']).toBeUndefined();
  expect(registryPkg.devDependencies?.['@mastra/mcp']).toBe('workspace:^');
});

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
        // Containment (not just overlap): every version our range can resolve to
        // must satisfy the peer range.
        if (!subset(declaredRange, peerRange, { includePrerelease: true })) {
          problems.push(
            `${depName} requires peer ${peerName}@${peerRange}, but @mastra/mcp declares ${peerName}@${declaredRange}, which can resolve to versions outside that range`,
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
