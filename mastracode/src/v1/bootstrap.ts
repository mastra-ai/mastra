/**
 * Minimal v1 Harness bootstrap. Stands the Harness up against an in-memory
 * LibSQL store and a single placeholder agent so we can sanity-check the v1
 * TUI plumbing. The real settings / auth / observability / dynamic agent
 * wiring layers in as the rebuild progresses.
 */
import { Agent } from '@mastra/core/agent';
import { Harness } from '@mastra/core/harness/v1';
import type { HarnessConfig } from '@mastra/core/harness/v1';
import { LibSQLStore } from '@mastra/libsql';

import { detectProject } from '../utils/project.js';
import type { ProjectInfo } from '../utils/project.js';

export interface BootstrapV1Result {
  harness: Harness;
  project: ProjectInfo;
}

/**
 * Build a v1 Harness wired to an in-memory LibSQL store and a single
 * `default` agent. Good enough to confirm session + signal + render
 * plumbing in `v1/tui/`. The next milestone replaces this with the real
 * resolveModel / memory / persistent storage setup.
 */
export async function bootstrapV1(): Promise<BootstrapV1Result> {
  const project = detectProject(process.cwd());

  // Single placeholder agent. No model wired yet — phase 0 of the v1 TUI
  // rebuild doesn't drive real turns; the next milestone swaps this for the
  // real dynamic-model resolver chain.
  const defaultAgent = new Agent({
    id: 'default',
    name: 'default',
    instructions: 'You are MastraCode v1 (scaffold). Respond briefly.',
    model: 'placeholder://no-model' as any,
  });

  const storage = new LibSQLStore({
    id: 'mastracode-v1-scaffold-storage',
    url: ':memory:',
  });

  const config: HarnessConfig = {
    agents: { default: defaultAgent } as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
    sessions: {
      storage: (storage as any).stores.harness,
    },
  };

  const harness = new Harness(config);
  return { harness, project };
}
