import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { vi } from 'vitest';
import { createOrganizationAgent } from '../../../../src/mastra/agents/organization-agent.js';
import type { OrganizationAnswer } from '../../../../src/mastra/answers/schema.js';
import type { SourceIndex } from '../../../../src/mastra/workspaces/source-index.js';
import { hits, sourceStatus } from '../../../fixtures/answers.js';
import { fixedLanguageModel } from '../../../fixtures/model.js';

export async function contextualAgent(directory: string, decision: unknown, error?: Error) {
  const search = vi.fn(async (_query: string, _topK: number) => hits);
  const onGroundedUsage = vi.fn();
  const recordQuery = vi.fn(async (_event: unknown) => undefined);
  const answerCalls = vi.fn();
  const contextualizationCalls = vi.fn();
  const storage = new LibSQLStore({ id: 'conversation-evaluation', url: 'file:' + join(directory, 'memory.db') });
  const agent = createOrganizationAgent(
    { search, sourceStatus: () => sourceStatus, telemetry: { recordQuery } } as unknown as SourceIndex,
    fixedLanguageModel(
      JSON.stringify({
        status: 'answered',
        answer: 'Invoices are retained for seven years.',
        citations: [{ recordId: 'policy-retention', locator: 'Retention' }],
      }),
      { onCall: answerCalls },
    ) as never,
    {
      contextualizationModel: fixedLanguageModel(JSON.stringify(decision), {
        onCall: contextualizationCalls,
        error,
      }) as never,
      onGroundedUsage,
    },
  );
  const mastra = new Mastra({ logger: false, storage, agents: { organizationAgent: agent } });
  const registered = mastra.getAgent('organizationAgent');
  const memory = (await registered.getMemory())!;
  return {
    agent: registered,
    memory,
    search,
    answerCalls,
    contextualizationCalls,
    onGroundedUsage,
    recordQuery,
    async ask(question: string, thread = 'conversation'): Promise<OrganizationAnswer> {
      const stream = await registered.stream(question, { memory: { thread, resource: 'test-user' } });
      let text = '';
      for await (const part of stream.fullStream) if (part.type === 'text-delta') text += part.payload.text;
      return JSON.parse(text) as OrganizationAnswer;
    },
    async close() {
      await memory.settled();
      await storage.close();
    },
  };
}
