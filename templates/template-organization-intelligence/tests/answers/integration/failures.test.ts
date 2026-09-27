import { describe, expect, it } from 'vitest';
import { askOrganizationAgent } from '../../../src/mastra/agents/organization-agent.js';
import { createOrganizationAnswerRoute } from '../../../src/mastra/api/organization.js';
import { createOrganizationMcpServer } from '../../../src/mastra/mcp/organization.js';
import type { SourceIndex } from '../../../src/mastra/workspaces/source-index.js';
import { createStatelessOrganizationAgent as createOrganizationAgent } from '../../fixtures/agent.js';
import { sourceStatus } from '../../fixtures/answers.js';
import { fixedLanguageModel } from '../../fixtures/model.js';
import { index } from './helpers/runtime.js';

describe('Organization Agent grounded answer integration', () => {
  it('channel failures are not unknown answers', async () => {
    const agent = createOrganizationAgent(index(), fixedLanguageModel('{truncated') as never);
    const stream = await agent.stream('What is the retention rule?');
    const parts = [];
    for await (const part of stream.fullStream) parts.push(part);

    const final = parts.find(part => part.type === 'text-delta');
    expect(final?.type === 'text-delta' && JSON.parse(final.payload.text)).toMatchObject({
      status: 'operational_error',
      citations: [],
      metadata: { validationFailure: 'invalid_json' },
    });

    const failingCalls: Array<{ prompt: unknown; tools?: unknown }> = [];
    const failingAgent = createOrganizationAgent(
      index(),
      fixedLanguageModel('', {
        error: () => new Error('synthetic-provider-secret'),
        onCall: call => failingCalls.push(call),
      }) as never,
    );
    const failingStream = await failingAgent.stream('What is the retention rule?');
    const failingParts = [];
    for await (const part of failingStream.fullStream) failingParts.push(part);
    const visibleFailure = JSON.stringify(failingParts);
    expect(visibleFailure).not.toContain('synthetic-provider-secret');
    const failingFinish = failingParts.find(part => part.type === 'finish');
    expect(failingFinish?.type === 'finish' && failingFinish.payload.stepResult.reason).toBe('error');
    const failingFinal = failingParts.find(part => part.type === 'text-delta');
    expect(failingFinal?.type === 'text-delta' && JSON.parse(failingFinal.payload.text)).toMatchObject({
      status: 'operational_error',
      citations: [],
    });

    const lengthAgent = createOrganizationAgent(
      index(),
      fixedLanguageModel(
        JSON.stringify({
          status: 'answered',
          answer: 'A partial answer must never be shown as grounded.',
          citations: [{ recordId: 'policy-retention', locator: 'Retention' }],
        }),
        { finishReason: 'length' },
      ) as never,
    );
    expect(await askOrganizationAgent(lengthAgent, 'What is the retention rule?')).toMatchObject({
      status: 'operational_error',
      citations: [],
    });

    const timeoutCalls: Array<{ prompt: unknown; tools?: unknown }> = [];
    const timeoutAgent = createOrganizationAgent(
      index(),
      fixedLanguageModel('', {
        error: () => Object.assign(new Error('synthetic-timeout-secret'), { name: 'AbortError' }),
        onCall: call => timeoutCalls.push(call),
      }) as never,
    );
    const timeoutStream = await timeoutAgent.stream('What is the retention rule?');
    const timeoutParts = [];
    for await (const part of timeoutStream.fullStream) timeoutParts.push(part);
    expect(JSON.stringify(timeoutParts)).not.toContain('synthetic-timeout-secret');
    const timeoutFinal = timeoutParts.find(part => part.type === 'text-delta');
    expect(timeoutFinal?.type === 'text-delta' && JSON.parse(timeoutFinal.payload.text)).toMatchObject({
      status: 'operational_error',
      citations: [],
    });

    const directFailure = await askOrganizationAgent(failingAgent, 'What is the retention rule?');
    const mcpFailure = await createOrganizationMcpServer(failingAgent).executeTool('answerOrganizationQuestion', {
      question: 'What is the retention rule?',
    });
    const route = createOrganizationAnswerRoute(failingAgent) as unknown as {
      handler: (context: {
        req: { json: () => Promise<unknown> };
        json: (body: unknown, status?: number) => Response;
      }) => Promise<Response>;
    };
    const apiFailure = await route.handler({
      req: { json: async () => ({ question: 'What is the retention rule?' }) },
      json: (body, status) => Response.json(body, { status }),
    });
    expect({ directFailure, mcpFailure, apiFailure: await apiFailure.json() }).toEqual(
      expect.objectContaining({
        directFailure: expect.objectContaining({ status: 'operational_error', citations: [] }),
        mcpFailure: expect.objectContaining({ status: 'operational_error', citations: [] }),
        apiFailure: expect.objectContaining({ status: 'operational_error', citations: [] }),
      }),
    );
    // maxRetries: 2 permits the initial model request plus two retry attempts per channel.
    expect(failingCalls).toHaveLength(12);
    expect(timeoutCalls).toHaveLength(3);

    const retrievalFailure = createOrganizationAgent(
      {
        search: async () => {
          throw new Error('synthetic-retrieval-secret');
        },
        sourceStatus: () => sourceStatus,
      } as unknown as SourceIndex,
      fixedLanguageModel(
        JSON.stringify({
          status: 'insufficient_evidence',
          answer: 'This answer must be treated as operationally unsafe.',
          citations: [],
        }),
      ) as never,
    );
    expect(await askOrganizationAgent(retrievalFailure, 'What is the retention rule?')).toMatchObject({
      status: 'operational_error',
      citations: [],
    });
  }, 45_000);
});
