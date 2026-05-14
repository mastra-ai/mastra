/**
 * Minimal v1 Harness bootstrap. Stands the Harness up against an in-memory
 * LibSQL store and a single placeholder agent. The Harness builds its own
 * Mastra internally when we hand it `agents` + `storage`, so thread CRUD
 * and the session storage domain both work out of the box.
 *
 * The real settings / auth / observability / dynamic agent wiring layers
 * in as the rebuild progresses.
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

export async function bootstrapV1(): Promise<BootstrapV1Result> {
  const project = detectProject(process.cwd());

  // Single placeholder agent. Milestone 1 only opens a session and
  // subscribes to events — no real model traffic yet. The next milestone
  // swaps this for the real dynamic-model resolver chain.
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
    storage: storage as any,
    modes: [{ id: 'default', agentId: 'default' }],
    defaultModeId: 'default',
  };

  const harness = new Harness(config);
  return { harness, project };
}
