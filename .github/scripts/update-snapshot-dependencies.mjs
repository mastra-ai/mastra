import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function updateSnapshotDependencies(content, file, workspacePackages) {
  const updated = content.replace(/"workspace:\^"/g, '"workspace:*"');
  // Some @mastra packages are published from other repositories.
  return updated.replace(/"(@mastra\/[^"]*)":\s*"([^"]*)"/g, (match, name, version) => {
    // The docs server intentionally uses the legacy MCP API. Keep its published
    // dependency until it explicitly opts into the workspace MCP implementation.
    if (
      file === 'packages/mcp-docs-server/package.json' &&
      name === '@mastra/mcp' &&
      !version.startsWith('workspace:')
    ) {
      return match;
    }
    return workspacePackages.has(name) ? `"${name}": "workspace:*"` : match;
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const workspacePackages = new Set(
    JSON.parse(execSync('pnpm m ls --depth -1 --json', { maxBuffer: 64 * 1024 * 1024 }))
      .map(pkg => pkg.name)
      .filter(Boolean),
  );
  const files = execSync('git ls-files -z "*/package.json"').toString().split('\0').filter(Boolean);
  let changedCount = 0;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    const updated = updateSnapshotDependencies(content, file, workspacePackages);
    if (updated !== content) {
      console.log(`Updating ${file}`);
      writeFileSync(file, updated);
      changedCount++;
    }
  }
  console.log(`Finished updating workspace dependencies. ${changedCount} files updated.`);
}
