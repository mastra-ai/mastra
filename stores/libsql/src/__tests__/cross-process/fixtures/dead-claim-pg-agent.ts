// A plain Agent whose tool suspends for a name, shared by the Postgres dead-claim test and its peer.
// The model is the test's aimock server, reached over HTTP from every process. The claim lives in
// a shared Postgres schema, not the LibSQL file the rest of this directory uses.
import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { PostgresStore } from '@mastra/pg';
import { z } from 'zod/v4';

/** Where the resumed tool parks so the test can SIGKILL the process. */
export type KillPoint = 'before-side-effect' | 'after-side-effect';

export interface DeadClaimPgAgentOptions {
  modelUrl: string;
  connectionString: string;
  logPath: string;
  killPoint?: KillPoint;
  onKillPoint?: () => void;
  /** Shared schema. The parent creates it; the peer must pass the same one. */
  schema?: string;
}

export async function createDeadClaimPgAgent({
  modelUrl,
  connectionString,
  logPath,
  killPoint,
  onKillPoint,
  schema = `deadclaim_${randomUUID().replace(/-/g, '')}`,
}: DeadClaimPgAgentOptions) {
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
          appendFileSync(logPath, `side-effect ${process.pid}\n`);
          await park('after-side-effect');
          return { name: resumeData.name };
        },
      }),
    },
  });
  const storage = new PostgresStore({
    id: `dead-claim-${process.pid}`,
    connectionString,
    schemaName: schema,
  });
  const mastra = new Mastra({ agents: { agent }, storage, logger: false, workers: false });
  return {
    agent: mastra.getAgent('agent'),
    mastra,
    storage,
    schema,
    dropSchema: async () => {
      await storage.db.none(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    },
  };
}
