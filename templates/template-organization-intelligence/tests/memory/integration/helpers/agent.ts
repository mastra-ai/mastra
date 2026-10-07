import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { createOrganizationAgent } from '../../../../src/mastra/agents/organization-agent.js';
import { index } from '../../../answers/integration/helpers/runtime.js';
import { unchangedQueryModel } from '../../../fixtures/contextualization.js';
import { fixedLanguageModel } from '../../../fixtures/model.js';

export async function openMemoryAgent(directory: string) {
  const prompts: unknown[] = [];
  const storage = new LibSQLStore({ id: 'memory-integration', url: 'file:' + join(directory, 'memory.db') });
  const agent = createOrganizationAgent(
    index(),
    fixedLanguageModel(
      JSON.stringify({
        status: 'answered',
        answer: 'Invoices are retained for seven years.',
        citations: [{ recordId: 'policy-retention', locator: 'Retention' }],
      }),
      { onCall: call => prompts.push(call.prompt) },
    ) as never,
    { contextualizationModel: unchangedQueryModel() as never },
  );
  const mastra = new Mastra({ logger: false, storage, agents: { organizationAgent: agent } });
  const memory = (await agent.getMemory())!;
  let closed = false;
  return {
    agent: mastra.getAgent('organizationAgent'),
    memory,
    prompts,
    async close() {
      if (closed) return;
      closed = true;
      await memory.settled();
      await storage.close();
    },
  };
}
