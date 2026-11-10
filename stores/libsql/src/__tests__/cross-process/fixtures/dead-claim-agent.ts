// A plain Agent whose tool suspends for a name, shared by the dead-claim test and its peer.
// The model is the test's aimock server, reached over HTTP from every process.
import { appendFileSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v4';

import { LibSQLStore } from '../../../storage';

/** Where the resumed tool parks so the test can SIGKILL the process. */
export type KillPoint = 'before-side-effect' | 'after-side-effect';

export interface DeadClaimAgentOptions {
  modelUrl: string;
  dbUrl: string;
  logPath: string;
  /** Report a store that cannot fence runs, like stores without run-ownership support. */
  fencing: boolean;
  killPoint?: KillPoint;
  onKillPoint?: () => void;
}

export async function createDeadClaimAgent({
  modelUrl,
  dbUrl,
  logPath,
  fencing,
  killPoint,
  onKillPoint,
}: DeadClaimAgentOptions) {
  const park = (point: KillPoint) => {
    if (killPoint !== point) return Promise.resolve();
    onKillPoint?.();
    return new Promise<void>(() => {});
  };
  const agent = new Agent({
    id: 'dead-claim-agent',
    name: 'Dead Claim Agent',
    instructions: 'You find users.',
    model: { id: 'openai/gpt-4o-mini', url: modelUrl, apiKey: 'aimock-test-key' },
    tools: {
      findUser: createTool({
        id: 'find-user',
        description: 'Finds a user by name',
        inputSchema: z.object({ query: z.string() }),
        suspendSchema: z.object({ message: z.string() }),
        resumeSchema: z.object({ name: z.string() }),
        execute: async (_input, context) => {
          const resumeData = context?.agent?.resumeData;
          if (!resumeData) {
            return context?.agent?.suspend({ message: 'Which user?' });
          }
          appendFileSync(logPath, `start ${process.pid}\n`);
          await park('before-side-effect');
          // The side effect a user cares about, e.g. an email sent or a row written.
          appendFileSync(logPath, `side-effect ${process.pid}\n`);
          await park('after-side-effect');
          return { name: resumeData.name };
        },
      }),
    },
  });
  const storage = new LibSQLStore({ id: `dead-claim-${process.pid}`, url: dbUrl });
  if (!fencing) {
    const workflows = await storage.getStore('workflows');
    if (!workflows) throw new Error('LibSQLStore has no workflows domain');
    workflows.supportsRunFencing = () => false;
  }
  const mastra = new Mastra({ agents: { agent }, storage, logger: false, workers: false });
  return { agent: mastra.getAgent('agent'), mastra, storage };
}
