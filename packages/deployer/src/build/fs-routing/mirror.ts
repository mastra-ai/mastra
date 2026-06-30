import { cp, lstat, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverFsAgents } from './discover';
import type { DiscoveredFsAgent } from './discover';

/**
 * Skip symlinks when copying workspace seeds. A symlink under
 * `agents/<name>/workspace/` could point outside the workspace and be preserved
 * in the bundle, letting the agent read arbitrary files at runtime. We copy only
 * regular files and directories.
 */
async function rejectSymlinks(source: string): Promise<boolean> {
  const stats = await lstat(source);
  return !stats.isSymbolicLink();
}

async function mirrorAgentSeeds(
  agent: DiscoveredFsAgent,
  workspaceName: string,
  bundleDir: string,
  mirrored: string[],
): Promise<void> {
  if (agent.workspaceSeedDir) {
    const destination = join(bundleDir, 'workspace', ...workspaceName.split('/'));
    await mkdir(destination, { recursive: true });
    await cp(agent.workspaceSeedDir, destination, { recursive: true, filter: rejectSymlinks });
    mirrored.push(workspaceName);
  }

  // Subagents nest under `<parent>/<child>`, matching the codegen workspace key.
  for (const child of agent.subagents ?? []) {
    await mirrorAgentSeeds(child, `${workspaceName}/${child.name}`, bundleDir, mirrored);
  }
}

/**
 * Mirror authored `agents/<name>/workspace/**` seed files into the bundled
 * output so each fs-routed agent starts with them on disk (Eve parity). Files
 * are copied to `<bundleDir>/workspace/<name>`, which is exactly where the
 * generated entry roots each agent's default workspace at runtime (resolved
 * relative to the bundled module via `import.meta.url`). Declared subagents
 * mirror to the nested `<bundleDir>/workspace/<parent>/<child>` path.
 *
 * Must run AFTER the bundle step, since bundling recreates the output dir.
 *
 * @param mastraDir   The user's `src/mastra` directory (source of seeds).
 * @param bundleDir   The final bundle directory (e.g. `<outputDirectory>/output`).
 * @returns the workspace names whose seeds were mirrored (`<parent>/<child>` for subagents).
 */
export async function mirrorFsAgentWorkspaces(mastraDir: string, bundleDir: string): Promise<string[]> {
  const agents = await discoverFsAgents(mastraDir);
  const mirrored: string[] = [];

  for (const agent of agents) {
    await mirrorAgentSeeds(agent, agent.name, bundleDir, mirrored);
  }

  return mirrored;
}
