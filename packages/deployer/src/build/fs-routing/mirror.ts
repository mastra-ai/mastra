import { cp, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { discoverFsAgents } from './discover';

/**
 * Mirror authored `agents/<name>/workspace/**` seed files into the bundled
 * output so each fs-routed agent starts with them on disk (Eve parity). Files
 * are copied to `<bundleDir>/workspace/<name>`, which is exactly where the
 * generated entry roots each agent's default workspace at runtime (resolved
 * relative to the bundled module via `import.meta.url`).
 *
 * Must run AFTER the bundle step, since bundling recreates the output dir.
 *
 * @param mastraDir   The user's `src/mastra` directory (source of seeds).
 * @param bundleDir   The final bundle directory (e.g. `<outputDirectory>/output`).
 * @returns the agent names whose workspace seeds were mirrored.
 */
export async function mirrorFsAgentWorkspaces(mastraDir: string, bundleDir: string): Promise<string[]> {
  const agents = await discoverFsAgents(mastraDir);
  const mirrored: string[] = [];

  for (const agent of agents) {
    if (!agent.workspaceSeedDir) {
      continue;
    }

    const destination = join(bundleDir, 'workspace', agent.name);
    await mkdir(destination, { recursive: true });
    await cp(agent.workspaceSeedDir, destination, { recursive: true });
    mirrored.push(agent.name);
  }

  return mirrored;
}
